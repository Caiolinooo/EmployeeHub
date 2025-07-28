/**
 * MIGRAÇÃO PRISMA → SUPABASE - TIPOS ATUALIZADOS ✅
 *
 * Data da Migração: 2025-01-25
 * Responsável: Augment Agent
 *
 * CAMPOS ADICIONADOS À TABELA users_unified:
 * - password: string | null
 * - authorization_status: string | null
 * - failed_login_attempts: number | null
 * - lock_until: string | null
 *
 * MAPEAMENTO DE CAMPOS:
 * - phoneNumber → phone_number
 * - firstName → first_name
 * - lastName → last_name
 * - accessPermissions → access_permissions
 *
 * STATUS: Tipos sincronizados com Supabase ✅
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          first_name: string
          last_name: string
          phone_number: string
          role: 'ADMIN' | 'USER' | 'MANAGER'
          position: string | null
          department: string | null
          avatar: string | null
          active: boolean
          password_last_changed: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name: string
          last_name: string
          phone_number: string
          role?: 'ADMIN' | 'USER' | 'MANAGER'
          position?: string | null
          department?: string | null
          avatar?: string | null
          active?: boolean
          password_last_changed?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string
          last_name?: string
          phone_number?: string
          role?: 'ADMIN' | 'USER' | 'MANAGER'
          position?: string | null
          department?: string | null
          avatar?: string | null
          active?: boolean
          password_last_changed?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_permissions: {
        Row: {
          id: string
          user_id: string
          module: string | null
          feature: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          module?: string | null
          feature?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          module?: string | null
          feature?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          title: string
          description: string | null
          content: string | null
          file_url: string | null
          category: string
          subcategory: string | null
          created_by: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          content?: string | null
          file_url?: string | null
          category: string
          subcategory?: string | null
          created_by: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          content?: string | null
          file_url?: string | null
          category?: string
          subcategory?: string | null
          created_by?: string
          updated_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      news: {
        Row: {
          id: string
          title: string
          content: string
          summary: string | null
          image_url: string | null
          published: boolean
          published_at: string | null
          created_by: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          summary?: string | null
          image_url?: string | null
          published?: boolean
          published_at?: string | null
          created_by: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          summary?: string | null
          image_url?: string | null
          published?: boolean
          published_at?: string | null
          created_by?: string
          updated_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      menu_items: {
        Row: {
          id: string
          label: string
          url: string
          icon: string | null
          parent_id: string | null
          order: number
          active: boolean
          requires_auth: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          label: string
          url: string
          icon?: string | null
          parent_id?: string | null
          order?: number
          active?: boolean
          requires_auth?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          label?: string
          url?: string
          icon?: string | null
          parent_id?: string | null
          order?: number
          active?: boolean
          requires_auth?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      dashboard_cards: {
        Row: {
          id: string
          title: string
          description: string | null
          icon: string | null
          url: string
          order: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          icon?: string | null
          url: string
          order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          icon?: string | null
          url?: string
          order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      settings: {
        Row: {
          id: string
          key: string
          value: Json
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      access_history: {
        Row: {
          id: string
          user_id: string
          action: string
          details: string | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          details?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: string
          details?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      verification_codes: {
        Row: {
          id: string
          user_id: string | null
          phone_number: string | null
          email: string | null
          code: string
          expires_at: string
          used: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          phone_number?: string | null
          email?: string | null
          code: string
          expires_at: string
          used?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          phone_number?: string | null
          email?: string | null
          code?: string
          expires_at?: string
          used?: boolean
          created_at?: string
        }
      }
      invite_codes: {
        Row: {
          id: string
          code: string
          email: string | null
          phone_number: string | null
          expires_at: string
          used: boolean
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          email?: string | null
          phone_number?: string | null
          expires_at: string
          used?: boolean
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          email?: string | null
          phone_number?: string | null
          expires_at?: string
          used?: boolean
          created_by?: string
          created_at?: string
        }
      }
      users_unified: {
        Row: {
          id: string
          email: string
          first_name: string
          last_name: string
          phone_number: string
          role: 'admin' | 'user' | 'gerente' | 'ADMIN' | 'USER' | 'MANAGER'
          position: string | null
          department: string | null
          avatar: string | null
          active: boolean
          is_active: boolean
          is_verified: boolean
          verification_code: string | null
          verification_code_expires: string | null
          password_hash: string | null
          password_last_changed: string | null
          access_permissions: Json | null
          access_history: Json | null
          profile_data: Json | null
          tax_id: string | null
          password: string | null
          authorization_status: string | null
          failed_login_attempts: number | null
          lock_until: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          first_name: string
          last_name: string
          phone_number: string
          role?: 'admin' | 'user' | 'gerente' | 'ADMIN' | 'USER' | 'MANAGER'
          position?: string | null
          department?: string | null
          avatar?: string | null
          active?: boolean
          is_active?: boolean
          is_verified?: boolean
          verification_code?: string | null
          verification_code_expires?: string | null
          password_hash?: string | null
          password_last_changed?: string | null
          access_permissions?: Json | null
          access_history?: Json | null
          profile_data?: Json | null
          tax_id?: string | null
          password?: string | null
          authorization_status?: string | null
          failed_login_attempts?: number | null
          lock_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string
          last_name?: string
          phone_number?: string
          role?: 'admin' | 'user' | 'gerente' | 'ADMIN' | 'USER' | 'MANAGER'
          position?: string | null
          department?: string | null
          avatar?: string | null
          active?: boolean
          is_active?: boolean
          is_verified?: boolean
          verification_code?: string | null
          verification_code_expires?: string | null
          password_hash?: string | null
          password_last_changed?: string | null
          access_permissions?: Json | null
          access_history?: Json | null
          profile_data?: Json | null
          tax_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
