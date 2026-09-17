import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateAndStoreCertificate } from '@/lib/certificates';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getUserIdFromToken(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) return null;

    const payload = verifyToken(token);
    if (payload && (payload.userId || (payload as any).sub)) {
        return (payload.userId as string) || ((payload as any).sub as string);
    }
    return null;
}

export async function GET(request: NextRequest) {
    try {
        const userId = getUserIdFromToken(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const courseId = searchParams.get('course_id');

        if (!courseId) {
            return NextResponse.json({ error: 'course_id is required' }, { status: 400 });
        }

        // Fetch attempts that need grading
        const { data: attempts, error } = await supabaseAdmin
            .from('academy_quiz_attempts')
            .select(`
                id,
                course_id,
                score_percentage,
                needs_grading,
                is_passed,
                created_at,
                enrollment:academy_enrollments (
                    id,
                    user_id,
                    user:users_unified (first_name, last_name, email)
                ),
                answers:academy_user_answers (
                    id,
                    text_answer,
                    score_awarded,
                    question:academy_questions (id, question_text, question_type)
                )
            `)
            .eq('course_id', courseId)
            .eq('needs_grading', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Failed to fetch pending attempts:', error);
            return NextResponse.json({ error: 'Failed to fetch pending attempts' }, { status: 500 });
        }

        return NextResponse.json({ success: true, attempts });
    } catch (error) {
        console.error('Error fetching pending attempts:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = getUserIdFromToken(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { attempt_id, grades } = body; // grades: { answer_id: string, score_awarded: number, is_correct: boolean }[]

        if (!attempt_id || !grades || !Array.isArray(grades)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Update individual answers
        for (const grade of grades) {
            await supabaseAdmin
                .from('academy_user_answers')
                .update({
                    score_awarded: grade.score_awarded,
                    is_correct: grade.is_correct
                })
                .eq('id', grade.answer_id)
                .eq('attempt_id', attempt_id);
        }

        // 2. Recalculate total score
        const { data: allAnswers } = await supabaseAdmin
            .from('academy_user_answers')
            .select('score_awarded, is_correct')
            .eq('attempt_id', attempt_id);

        let totalCorrect = 0;
        const totalQuestions = allAnswers?.length || 1;

        if (allAnswers) {
            allAnswers.forEach(ans => {
                if (ans.is_correct) totalCorrect++;
            });
        }

        const scorePercentage = Math.round((totalCorrect / totalQuestions) * 100);
        const PASSING_SCORE = 70;
        const isPassed = scorePercentage >= PASSING_SCORE;

        // 3. Update attempt
        const { data: attempt, error: attemptError } = await supabaseAdmin
            .from('academy_quiz_attempts')
            .update({
                needs_grading: false,
                score_percentage: scorePercentage,
                is_passed: isPassed
            })
            .eq('id', attempt_id)
            .select('*, enrollment:academy_enrollments(id)')
            .single();

        if (attemptError || !attempt) {
            return NextResponse.json({ error: 'Failed to update attempt' }, { status: 500 });
        }

        // 4. Issue certificate if passed
        let certificateIssued = false;
        if (isPassed && attempt.enrollment) {
            const enrollmentId = attempt.enrollment.id;
            await supabaseAdmin.from('academy_enrollments').update({ completed_at: new Date().toISOString() }).eq('id', enrollmentId);
            try {
                const gen = await generateAndStoreCertificate(enrollmentId);
                if (gen) certificateIssued = true;
            } catch (certErr) {
                console.error('Error generating certificate inside grading:', certErr);
            }
        }

        return NextResponse.json({
            success: true,
            scorePercentage,
            isPassed,
            certificateIssued
        });

    } catch (error) {
        console.error('Error grading attempt:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
