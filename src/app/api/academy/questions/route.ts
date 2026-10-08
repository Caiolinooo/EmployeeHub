import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';

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

async function verifyPermissions(userId: string): Promise<boolean> {
    const { data: userData, error } = await supabaseAdmin
        .from('users_unified')
        .select('role, access_permissions')
        .eq('id', userId)
        .single();

    if (error || !userData) return false;

    return (
        userData.role === 'ADMIN' ||
        userData.access_permissions?.features?.academy_editor === true ||
        (await canWithGrant(userId, userData.role, ['academy.questions.manage'], 'admin'))
    );
}

// GET - List questions for a course
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

        const { data: questions, error } = await supabaseAdmin
            .from('academy_questions')
            .select(`
        id, course_id, question_text, question_type, sort_order,
        options:academy_question_options(id, option_text, is_correct, sort_order)
      `)
            .eq('course_id', courseId)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Error fetching questions:', error);
            return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
        }

        return NextResponse.json({ success: true, questions: questions || [] });

    } catch (error) {
        console.error('Error in questions API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Create a new question + options
export async function POST(request: NextRequest) {
    try {
        const userId = getUserIdFromToken(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hasPermission = await verifyPermissions(userId);
        if (!hasPermission) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        const body = await request.json();
        const { course_id, question_text, question_type, sort_order, options } = body;

        if (!course_id || !question_text) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Create Question
        const { data: question, error: qError } = await supabaseAdmin
            .from('academy_questions')
            .insert({
                course_id,
                question_text,
                question_type: question_type || 'MULTIPLE_CHOICE',
                sort_order: sort_order || 0
            })
            .select()
            .single();

        if (qError) {
            console.error('Error creating question:', qError);
            return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
        }

        // Create Options if multiple choice
        if (question.question_type === 'MULTIPLE_CHOICE' && options && Array.isArray(options)) {
            const optionsToInsert = options.map((opt: any, index: number) => ({
                question_id: question.id,
                option_text: opt.option_text,
                is_correct: opt.is_correct || false,
                sort_order: opt.sort_order ?? index
            }));

            if (optionsToInsert.length > 0) {
                const { error: optError } = await supabaseAdmin
                    .from('academy_question_options')
                    .insert(optionsToInsert);

                if (optError) {
                    console.error('Error creating options:', optError);
                }
            }
        }

        return NextResponse.json({ success: true, question });

    } catch (error) {
        console.error('Error in questions POST:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT - Update a question (or its options)
export async function PUT(request: NextRequest) {
    try {
        const userId = getUserIdFromToken(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hasPermission = await verifyPermissions(userId);
        if (!hasPermission) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        const body = await request.json();
        const { id, question_text, sort_order, options } = body;

        if (!id) {
            return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });
        }

        // Update question
        if (question_text || sort_order !== undefined) {
            const { error: qError } = await supabaseAdmin
                .from('academy_questions')
                .update({
                    ...(question_text && { question_text }),
                    ...(sort_order !== undefined && { sort_order }),
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (qError) {
                return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
            }
        }

        // Update options (naive approach: delete all existing and recreate)
        if (options && Array.isArray(options)) {
            await supabaseAdmin.from('academy_question_options').delete().eq('question_id', id);

            const optionsToInsert = options.map((opt: any, index: number) => ({
                question_id: id,
                option_text: opt.option_text,
                is_correct: opt.is_correct || false,
                sort_order: opt.sort_order ?? index
            }));

            if (optionsToInsert.length > 0) {
                await supabaseAdmin.from('academy_question_options').insert(optionsToInsert);
            }
        }

        return NextResponse.json({ success: true, message: 'Question updated successfully' });

    } catch (error) {
        console.error('Error in questions PUT:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Delete a question
export async function DELETE(request: NextRequest) {
    try {
        const userId = getUserIdFromToken(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hasPermission = await verifyPermissions(userId);
        if (!hasPermission) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('academy_questions')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Question deleted' });

    } catch (error) {
        console.error('Error in questions DELETE:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
