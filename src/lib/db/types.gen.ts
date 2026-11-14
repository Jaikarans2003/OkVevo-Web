
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_rollups": {
                  Row: {
                    "data": NonNullable<Json>,"day": string,"written_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "data"?: NonNullable<Json>,"day": string,"written_at"?: string
                  }
                  Update: {
                    "data"?: NonNullable<Json>,"day"?: string,"written_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_accounts": {
                  Row: {
                    "access_mode": string,"account_kind": string,"allocation_balance": number,"allocation_granted_total": number,"billing_cycle": string | null,"cancel_at_period_end": boolean,"concurrency_override": number | null,"created_at": string,"credits_included": number,"currency": string | null,"current_period_end": string | null,"has_scheduled_changes": boolean,"id": string,"next_allocation_date": string | null,"owner_user_id": string,"payment_method": string | null,"plan": string | null,"plan_name": string | null,"plan_status": string | null,"razorpay_customer_id": string | null,"razorpay_subscription_id": string | null,"scheduled_change_at": string | null,"scheduled_plan_id": string | null,"scheduled_plan_type": string | null,"top_up_balance": number,"top_up_purchased_total": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_mode"?: string,"account_kind"?: string,"allocation_balance"?: number,"allocation_granted_total"?: number,"billing_cycle"?: string | null,"cancel_at_period_end"?: boolean,"concurrency_override"?: number | null,"created_at"?: string,"credits_included"?: number,"currency"?: string | null,"current_period_end"?: string | null,"has_scheduled_changes"?: boolean,"id"?: string,"next_allocation_date"?: string | null,"owner_user_id": string,"payment_method"?: string | null,"plan"?: string | null,"plan_name"?: string | null,"plan_status"?: string | null,"razorpay_customer_id"?: string | null,"razorpay_subscription_id"?: string | null,"scheduled_change_at"?: string | null,"scheduled_plan_id"?: string | null,"scheduled_plan_type"?: string | null,"top_up_balance"?: number,"top_up_purchased_total"?: number,"updated_at"?: string
                  }
                  Update: {
                    "access_mode"?: string,"account_kind"?: string,"allocation_balance"?: number,"allocation_granted_total"?: number,"billing_cycle"?: string | null,"cancel_at_period_end"?: boolean,"concurrency_override"?: number | null,"created_at"?: string,"credits_included"?: number,"currency"?: string | null,"current_period_end"?: string | null,"has_scheduled_changes"?: boolean,"id"?: string,"next_allocation_date"?: string | null,"owner_user_id"?: string,"payment_method"?: string | null,"plan"?: string | null,"plan_name"?: string | null,"plan_status"?: string | null,"razorpay_customer_id"?: string | null,"razorpay_subscription_id"?: string | null,"scheduled_change_at"?: string | null,"scheduled_plan_id"?: string | null,"scheduled_plan_type"?: string | null,"top_up_balance"?: number,"top_up_purchased_total"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "billing_accounts_owner_user_id_fkey"
      columns: ["owner_user_id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"cloned_voices": {
                  Row: {
                    "character": string | null,"cloned_at": string | null,"consent_at": string | null,"created_at": string,"custom_voice_id": string,"deleted_at": string | null,"id": string,"project": string | null,"sample_sha256": string | null,"status": string,"used_in_tts_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "character"?: string | null,"cloned_at"?: string | null,"consent_at"?: string | null,"created_at"?: string,"custom_voice_id": string,"deleted_at"?: string | null,"id": string,"project"?: string | null,"sample_sha256"?: string | null,"status"?: string,"used_in_tts_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "character"?: string | null,"cloned_at"?: string | null,"consent_at"?: string | null,"created_at"?: string,"custom_voice_id"?: string,"deleted_at"?: string | null,"id"?: string,"project"?: string | null,"sample_sha256"?: string | null,"status"?: string,"used_in_tts_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cloned_voices_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_submissions": {
                  Row: {
                    "category": string,"created_at": string,"email": string,"id": string,"message": string,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"email": string,"id"?: string,"message": string,"whatsapp"?: string | null
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"email"?: string,"id"?: string,"message"?: string,"whatsapp"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"credit_transactions": {
                  Row: {
                    "absorbed": number,"amount": number,"billing_account_id": string,"bucket": string | null,"completion_tokens": number | null,"cost_usd": number | null,"created_at": string,"end_customer_ref": string | null,"expires_at": string | null,"id": string,"mode": string | null,"model": string | null,"price_usd": number | null,"prompt_tokens": number | null,"provider": string | null,"reason": string | null,"request_id": string | null,"type": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "absorbed"?: number,"amount": number,"billing_account_id": string,"bucket"?: string | null,"completion_tokens"?: number | null,"cost_usd"?: number | null,"created_at"?: string,"end_customer_ref"?: string | null,"expires_at"?: string | null,"id": string,"mode"?: string | null,"model"?: string | null,"price_usd"?: number | null,"prompt_tokens"?: number | null,"provider"?: string | null,"reason"?: string | null,"request_id"?: string | null,"type": string,"user_id"?: string | null
                  }
                  Update: {
                    "absorbed"?: number,"amount"?: number,"billing_account_id"?: string,"bucket"?: string | null,"completion_tokens"?: number | null,"cost_usd"?: number | null,"created_at"?: string,"end_customer_ref"?: string | null,"expires_at"?: string | null,"id"?: string,"mode"?: string | null,"model"?: string | null,"price_usd"?: number | null,"prompt_tokens"?: number | null,"provider"?: string | null,"reason"?: string | null,"request_id"?: string | null,"type"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "credit_transactions_billing_account_id_fkey"
      columns: ["billing_account_id"]
isOneToOne: false
      referencedRelation: "billing_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "credit_transactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"desktop_auth_codes": {
                  Row: {
                    "code": string,"created_at": string,"expires_at": string,"state": string,"used": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"expires_at": string,"state": string,"used"?: boolean,"user_id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"expires_at"?: string,"state"?: string,"used"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "desktop_auth_codes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"drama_uploads": {
                  Row: {
                    "bytes": number | null,"created_at": string,"duration_seconds": number | null,"generation": string | null,"height": number | null,"id": string,"kind": string | null,"mime": string | null,"path": string,"sha256": string | null,"user_id": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bytes"?: number | null,"created_at"?: string,"duration_seconds"?: number | null,"generation"?: string | null,"height"?: number | null,"id": string,"kind"?: string | null,"mime"?: string | null,"path": string,"sha256"?: string | null,"user_id": string,"width"?: number | null
                  }
                  Update: {
                    "bytes"?: number | null,"created_at"?: string,"duration_seconds"?: number | null,"generation"?: string | null,"height"?: number | null,"id"?: string,"kind"?: string | null,"mime"?: string | null,"path"?: string,"sha256"?: string | null,"user_id"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "drama_uploads_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"fal_media_index": {
                  Row: {
                    "created_at": string,"endpoint": string | null,"height": number | null,"id": string,"kind": string,"request_id": string | null,"seconds": number | null,"uid": string | null,"url": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"endpoint"?: string | null,"height"?: number | null,"id": string,"kind": string,"request_id"?: string | null,"seconds"?: number | null,"uid"?: string | null,"url": string,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"endpoint"?: string | null,"height"?: number | null,"id"?: string,"kind"?: string,"request_id"?: string | null,"seconds"?: number | null,"uid"?: string | null,"url"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fal_media_index_uid_fkey"
      columns: ["uid"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"fal_queues": {
                  Row: {
                    "needs_submit": boolean,"queued": NonNullable<Json>,"queued_count": number,"running": NonNullable<Json>,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "needs_submit"?: boolean,"queued"?: NonNullable<Json>,"queued_count"?: number,"running"?: NonNullable<Json>,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "needs_submit"?: boolean,"queued"?: NonNullable<Json>,"queued_count"?: number,"running"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fal_queues_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"fal_run_idempotency": {
                  Row: {
                    "body_hash": string | null,"created_at": string,"fal_request_id": string | null,"hold_id": string | null,"id": string,"phase": string | null,"run_id": string,"submit_started": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_hash"?: string | null,"created_at"?: string,"fal_request_id"?: string | null,"hold_id"?: string | null,"id": string,"phase"?: string | null,"run_id": string,"submit_started"?: boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "body_hash"?: string | null,"created_at"?: string,"fal_request_id"?: string | null,"hold_id"?: string | null,"id"?: string,"phase"?: string | null,"run_id"?: string,"submit_started"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fal_run_idempotency_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"gateway_jobs": {
                  Row: {
                    "actual_credits": number | null,"alias_of": string | null,"billing_account_id": string,"cancel_requested": boolean,"captured": boolean,"captured_at": string | null,"captured_fal_usd": number | null,"character": string | null,"client_code": string | null,"client_message": string | null,"consent_at": string | null,"created_at": string,"dispatched_at": string | null,"end_customer_ref": string | null,"endpoint": string | null,"estimated_credits": number | null,"fal_body": Json | null,"fal_cancel_url": string | null,"fal_request_id": string | null,"fal_response_url": string | null,"fal_status_url": string | null,"first_reject_at_ms": number | null,"held_allocation": number | null,"held_top_up": number | null,"hold_expires_at": string | null,"hold_id": string | null,"id": string,"media": Json | null,"next_attempt_at_ms": number | null,"payload": Json | null,"price_snapshot": Json | null,"project": string | null,"provider": string | null,"queue_position": number | null,"release_reason": string | null,"request_id": string | null,"reserved_fal_usd": number | null,"run_id": string | null,"sample_sha256": string | null,"settled_at": string | null,"settled_credits": number | null,"settled_fal_usd": number | null,"spend_day": string | null,"status": string | null,"submit_args": Json | null,"submit_attempts": number,"unit": string | null,"unit_price": number | null,"updated_at": string,"user_id": string,"vendor_status": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_credits"?: number | null,"alias_of"?: string | null,"billing_account_id": string,"cancel_requested"?: boolean,"captured"?: boolean,"captured_at"?: string | null,"captured_fal_usd"?: number | null,"character"?: string | null,"client_code"?: string | null,"client_message"?: string | null,"consent_at"?: string | null,"created_at"?: string,"dispatched_at"?: string | null,"end_customer_ref"?: string | null,"endpoint"?: string | null,"estimated_credits"?: number | null,"fal_body"?: Json | null,"fal_cancel_url"?: string | null,"fal_request_id"?: string | null,"fal_response_url"?: string | null,"fal_status_url"?: string | null,"first_reject_at_ms"?: number | null,"held_allocation"?: number | null,"held_top_up"?: number | null,"hold_expires_at"?: string | null,"hold_id"?: string | null,"id": string,"media"?: Json | null,"next_attempt_at_ms"?: number | null,"payload"?: Json | null,"price_snapshot"?: Json | null,"project"?: string | null,"provider"?: string | null,"queue_position"?: number | null,"release_reason"?: string | null,"request_id"?: string | null,"reserved_fal_usd"?: number | null,"run_id"?: string | null,"sample_sha256"?: string | null,"settled_at"?: string | null,"settled_credits"?: number | null,"settled_fal_usd"?: number | null,"spend_day"?: string | null,"status"?: string | null,"submit_args"?: Json | null,"submit_attempts"?: number,"unit"?: string | null,"unit_price"?: number | null,"updated_at"?: string,"user_id": string,"vendor_status"?: number | null
                  }
                  Update: {
                    "actual_credits"?: number | null,"alias_of"?: string | null,"billing_account_id"?: string,"cancel_requested"?: boolean,"captured"?: boolean,"captured_at"?: string | null,"captured_fal_usd"?: number | null,"character"?: string | null,"client_code"?: string | null,"client_message"?: string | null,"consent_at"?: string | null,"created_at"?: string,"dispatched_at"?: string | null,"end_customer_ref"?: string | null,"endpoint"?: string | null,"estimated_credits"?: number | null,"fal_body"?: Json | null,"fal_cancel_url"?: string | null,"fal_request_id"?: string | null,"fal_response_url"?: string | null,"fal_status_url"?: string | null,"first_reject_at_ms"?: number | null,"held_allocation"?: number | null,"held_top_up"?: number | null,"hold_expires_at"?: string | null,"hold_id"?: string | null,"id"?: string,"media"?: Json | null,"next_attempt_at_ms"?: number | null,"payload"?: Json | null,"price_snapshot"?: Json | null,"project"?: string | null,"provider"?: string | null,"queue_position"?: number | null,"release_reason"?: string | null,"request_id"?: string | null,"reserved_fal_usd"?: number | null,"run_id"?: string | null,"sample_sha256"?: string | null,"settled_at"?: string | null,"settled_credits"?: number | null,"settled_fal_usd"?: number | null,"spend_day"?: string | null,"status"?: string | null,"submit_args"?: Json | null,"submit_attempts"?: number,"unit"?: string | null,"unit_price"?: number | null,"updated_at"?: string,"user_id"?: string,"vendor_status"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "gateway_jobs_billing_account_id_fkey"
      columns: ["billing_account_id"]
isOneToOne: false
      referencedRelation: "billing_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gateway_jobs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"ops_alerts": {
                  Row: {
                    "created_at": string,"data": NonNullable<Json>,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"data"?: NonNullable<Json>,"id": string
                  }
                  Update: {
                    "created_at"?: string,"data"?: NonNullable<Json>,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"razorpay_subscriptions": {
                  Row: {
                    "activated_at": string | null,"affiliate_id": string | null,"being_replaced_by": string | null,"billing_account_id": string | null,"cancel_at_cycle_end": boolean | null,"cancelled_at": string | null,"charge_count": number,"completed_at": string | null,"coupon_applied": boolean | null,"coupon_code": string | null,"coupon_type": string | null,"created_at": string,"credits": number | null,"credits_used": number | null,"discount_amount": string | null,"expires_at": string | null,"grace_period_ends_at": string | null,"halted_at": string | null,"id": string,"initial_credits": number | null,"invoice_paid_at": string | null,"last_payment_amount": number | null,"last_payment_at": string | null,"last_payment_failure": Json | null,"last_payment_id": string | null,"notes": Json | null,"paused_at": string | null,"payment_method": string | null,"payment_method_updated_at": string | null,"plan_type": string | null,"replacing_subscription_id": string | null,"resumed_at": string | null,"status": string | null,"updated_at": string,"will_activate_at": string | null,"will_cancel_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"affiliate_id"?: string | null,"being_replaced_by"?: string | null,"billing_account_id"?: string | null,"cancel_at_cycle_end"?: boolean | null,"cancelled_at"?: string | null,"charge_count"?: number,"completed_at"?: string | null,"coupon_applied"?: boolean | null,"coupon_code"?: string | null,"coupon_type"?: string | null,"created_at"?: string,"credits"?: number | null,"credits_used"?: number | null,"discount_amount"?: string | null,"expires_at"?: string | null,"grace_period_ends_at"?: string | null,"halted_at"?: string | null,"id": string,"initial_credits"?: number | null,"invoice_paid_at"?: string | null,"last_payment_amount"?: number | null,"last_payment_at"?: string | null,"last_payment_failure"?: Json | null,"last_payment_id"?: string | null,"notes"?: Json | null,"paused_at"?: string | null,"payment_method"?: string | null,"payment_method_updated_at"?: string | null,"plan_type"?: string | null,"replacing_subscription_id"?: string | null,"resumed_at"?: string | null,"status"?: string | null,"updated_at"?: string,"will_activate_at"?: string | null,"will_cancel_at"?: string | null
                  }
                  Update: {
                    "activated_at"?: string | null,"affiliate_id"?: string | null,"being_replaced_by"?: string | null,"billing_account_id"?: string | null,"cancel_at_cycle_end"?: boolean | null,"cancelled_at"?: string | null,"charge_count"?: number,"completed_at"?: string | null,"coupon_applied"?: boolean | null,"coupon_code"?: string | null,"coupon_type"?: string | null,"created_at"?: string,"credits"?: number | null,"credits_used"?: number | null,"discount_amount"?: string | null,"expires_at"?: string | null,"grace_period_ends_at"?: string | null,"halted_at"?: string | null,"id"?: string,"initial_credits"?: number | null,"invoice_paid_at"?: string | null,"last_payment_amount"?: number | null,"last_payment_at"?: string | null,"last_payment_failure"?: Json | null,"last_payment_id"?: string | null,"notes"?: Json | null,"paused_at"?: string | null,"payment_method"?: string | null,"payment_method_updated_at"?: string | null,"plan_type"?: string | null,"replacing_subscription_id"?: string | null,"resumed_at"?: string | null,"status"?: string | null,"updated_at"?: string,"will_activate_at"?: string | null,"will_cancel_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "razorpay_subscriptions_billing_account_id_fkey"
      columns: ["billing_account_id"]
isOneToOne: false
      referencedRelation: "billing_accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"razorpay_webhook_events": {
                  Row: {
                    "event_id": string,"event_type": string | null,"received_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"event_type"?: string | null,"received_at"?: string
                  }
                  Update: {
                    "event_id"?: string,"event_type"?: string | null,"received_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"spend_daily": {
                  Row: {
                    "credits_charged": number,"day": string,"fal_usd": number,"fal_usd_held": number,"jobs": number,"over_reserve_events": number
                  }
                  ComputedFields: never
                  Insert: {
                    "credits_charged"?: number,"day": string,"fal_usd"?: number,"fal_usd_held"?: number,"jobs"?: number,"over_reserve_events"?: number
                  }
                  Update: {
                    "credits_charged"?: number,"day"?: string,"fal_usd"?: number,"fal_usd_held"?: number,"jobs"?: number,"over_reserve_events"?: number
                  }
                  Relationships: [
                    
                  ]
                },"upload_rate_limits": {
                  Row: {
                    "count": number,"user_id": string,"window_start_ms": number
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"user_id": string,"window_start_ms": number
                  }
                  Update: {
                    "count"?: number,"user_id"?: string,"window_start_ms"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "upload_rate_limits_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"users": {
                  Row: {
                    "bio": string | null,"created_at": string,"display_name": string | null,"email": string | null,"id": string,"phone_number": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string | null,"created_at"?: string,"display_name"?: string | null,"email"?: string | null,"id": string,"phone_number"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "bio"?: string | null,"created_at"?: string,"display_name"?: string | null,"email"?: string | null,"id"?: string,"phone_number"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
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
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
