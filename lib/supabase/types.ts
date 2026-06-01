export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      staff: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          role: "admin" | "doctor" | "nurse" | "receptionist";
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["staff"]["Row"], "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff"]["Insert"]>;
      };
      patients: {
        Row: {
          id: number;
          first_name: string;
          last_name: string;
          date_of_birth: string;
          gender: string;
          phone: string;
          phone_normalized: string | null;
          email: string | null;
          address: string;
          consent: boolean;
          is_registered: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["patients"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["patients"]["Insert"]>;
      };
      checkin_types: {
        Row: { id: number; type_name: string; description: string | null };
        Insert: Database["public"]["Tables"]["checkin_types"]["Row"];
        Update: Partial<Database["public"]["Tables"]["checkin_types"]["Insert"]>;
      };
      checkins: {
        Row: {
          checkin_id: number;
          patient_id: number;
          type_id: number;
          doctor_id: string | null;
          app_type_id: number | null;
          reference_number: string;
          scheduled_time: string | null;
          appointment_date: string | null;
          actual_checkin_time: string | null;
          reason: string | null;
          status: string | null;
          priority: string;
          consent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["checkins"]["Row"], "checkin_id" | "created_at" | "updated_at"> & {
          checkin_id?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["checkins"]["Insert"]>;
      };
      appointment_types: {
        Row: {
          id: number;
          name: string;
          duration: number;
          description: string | null;
          is_active: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["appointment_types"]["Row"], "id"> & { id?: number };
        Update: Partial<Database["public"]["Tables"]["appointment_types"]["Insert"]>;
      };
      queue: {
        Row: {
          id: number;
          checkin_id: number;
          queue_number: string;
          priority: string;
          status: string;
          called_at: string | null;
          called_by: string | null;
          room_id: number | null;
          completed_at: string | null;
          skip_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["queue"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["queue"]["Insert"]>;
      };
      rooms: {
        Row: { id: number; name: string; description: string | null; is_active: boolean };
        Insert: Omit<Database["public"]["Tables"]["rooms"]["Row"], "id"> & { id?: number };
        Update: Partial<Database["public"]["Tables"]["rooms"]["Insert"]>;
      };
      display_settings: {
        Row: {
          id: number;
          display_name: string;
          location: string;
          show_wait_time: boolean;
          show_priority: boolean;
          theme_color: string;
          is_active: boolean;
          last_ping: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["display_settings"]["Row"], "id"> & { id?: number };
        Update: Partial<Database["public"]["Tables"]["display_settings"]["Insert"]>;
      };
      audit_log: {
        Row: {
          id: number;
          user_id: string | null;
          action: string;
          table_name: string;
          record_id: number | null;
          old_values: string | null;
          new_values: string | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audit_log"]["Row"], "id" | "created_at"> & {
          id?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
      };
      doctor_schedules: {
        Row: {
          id: number;
          doctor_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_active: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["doctor_schedules"]["Row"], "id"> & { id?: number };
        Update: Partial<Database["public"]["Tables"]["doctor_schedules"]["Insert"]>;
      };
      doctor_blocks: {
        Row: {
          id: number;
          doctor_id: string;
          block_date: string | null;
          day_of_week: number | null;
          start_time: string;
          end_time: string;
          reason: string;
          is_recurring: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["doctor_blocks"]["Row"], "id"> & { id?: number };
        Update: Partial<Database["public"]["Tables"]["doctor_blocks"]["Insert"]>;
      };
      rate_limits: {
        Row: {
          id: number;
          action: string;
          ip_address: string;
          request_count: number;
          window_start: string;
        };
        Insert: Omit<Database["public"]["Tables"]["rate_limits"]["Row"], "id"> & { id?: number };
        Update: Partial<Database["public"]["Tables"]["rate_limits"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
