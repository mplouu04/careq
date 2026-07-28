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
          public_id: string;
          first_name: string;
          last_name: string;
          date_of_birth: string;
          gender: string;
          phone: string;
          phone_normalized: string | null;
          phone_last7: string | null;
          email: string | null;
          address: string;
          consent: boolean;
          is_registered: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["patients"]["Row"],
          "id" | "phone_last7" | "created_at" | "updated_at"
        > & {
          id?: number;
          phone_last7?: string | null;
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
          status: string;
          priority: string;
          consent: boolean;
          reminder_sent_at: string | null;
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
          buffer_minutes: number;
          max_concurrent: number;
          default_priority: string;
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
          clinic_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["queue"]["Row"],
          "id" | "clinic_date" | "created_at" | "updated_at"
        > & {
          id?: number;
          clinic_date?: string;
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
      daily_counters: {
        Row: {
          counter_date: string;
          counter_key: string;
          last_value: number;
        };
        Insert: Database["public"]["Tables"]["daily_counters"]["Row"];
        Update: Partial<Database["public"]["Tables"]["daily_counters"]["Insert"]>;
      };
      patient_sessions: {
        Row: {
          token: string;
          patient_id: number;
          expires_at: string;
          used: boolean;
          ip: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["patient_sessions"]["Row"], "token"> & {
          token?: string;
        };
        Update: Partial<Database["public"]["Tables"]["patient_sessions"]["Insert"]>;
      };
      reminder_failures: {
        Row: {
          id: number;
          checkin_id: number | null;
          reference_number: string;
          recipient_email: string | null;
          error_message: string;
          retryable: boolean;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["reminder_failures"]["Row"], "id" | "created_at"> & {
          id?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reminder_failures"]["Insert"]>;
      };
      push_subscriptions: {
        Row: {
          id: number;
          queue_number: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["push_subscriptions"]["Row"], "id" | "created_at"> & {
          id?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_queue_waiting_position: {
        Args: {
          p_queue_id: number;
          p_day_start: string;
          p_day_end: string;
        };
        Returns: number;
      };
      purge_old_logs: {
        Args: { p_days?: number };
        Returns: {
          rate_limits_deleted: number;
          audit_deleted: number;
          sessions_deleted: number;
        }[];
      };
      purge_expired_patient_sessions: {
        Args: Record<string, never>;
        Returns: number;
      };
      increment_rate_limit: {
        Args: {
          p_action: string;
          p_ip: string;
          p_max: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      next_counter: {
        Args: {
          p_date: string;
          p_key: string;
        };
        Returns: number;
      };
      checkin_to_queue: {
        Args: {
          p_checkin_id: number;
          p_prefix: string;
        };
        Returns: string;
      };
      book_appointment_slot: {
        Args: {
          p_patient_id: number;
          p_doctor_id: string;
          p_app_type_id: number;
          p_appointment_date: string;
          p_scheduled_time: string;
          p_duration_minutes: number;
          p_max_concurrent: number;
          p_reference_number: string;
          p_reason: string | null;
          p_consent: boolean;
          p_priority: string;
        };
        Returns: { out_checkin_id: number; out_reference_number: string }[];
      };
      upsert_doctor_schedules: {
        Args: {
          p_doctor_id: string;
          p_schedules: Json;
        };
        Returns: number;
      };
      record_verification_failure: {
        Args: {
          p_ip: string;
          p_max_failures?: number;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
  };
};
