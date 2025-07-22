CREATE TABLE "calendar_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"project_id" integer,
	"event_id" varchar,
	"status" varchar NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_id" uuid NOT NULL,
	"ninja_client_id" varchar,
	"name" varchar NOT NULL,
	"email" varchar,
	"address" text,
	"phone" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crew_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"crew_id" integer NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"address" text,
	"unique_number" varchar NOT NULL,
	"phone" varchar,
	"role" varchar DEFAULT 'worker',
	"member_email" varchar,
	"google_calendar_id" varchar,
	"archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crews" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_id" uuid NOT NULL,
	"name" varchar NOT NULL,
	"unique_number" varchar NOT NULL,
	"leader_name" varchar NOT NULL,
	"phone" varchar,
	"address" text,
	"status" varchar DEFAULT 'active' NOT NULL,
	"archived" boolean DEFAULT false,
	"gcal_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_storage" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" varchar NOT NULL,
	"original_name" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"mime_type" varchar NOT NULL,
	"size" integer NOT NULL,
	"category" varchar NOT NULL,
	"project_id" integer,
	"uploaded_by" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	CONSTRAINT "file_storage_file_id_unique" UNIQUE("file_id")
);
--> statement-breakpoint
CREATE TABLE "firms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"invoice_ninja_url" varchar NOT NULL,
	"token" varchar NOT NULL,
	"address" text,
	"tax_id" varchar,
	"logo_url" varchar,
	"gcal_master_id" varchar,
	"postmark_server_token" varchar,
	"postmark_from_email" varchar,
	"postmark_message_stream" varchar DEFAULT 'transactional',
	"email_subject_template" varchar DEFAULT 'Счет №{{invoiceNumber}} от {{firmName}}',
	"email_body_template" text DEFAULT 'Уважаемый {{clientName}},

Во вложении находится счет №{{invoiceNumber}} за установку солнечных панелей.

С уважением,
{{firmName}}',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "google_calendar_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_id" uuid NOT NULL,
	"client_id" varchar NOT NULL,
	"client_secret" varchar NOT NULL,
	"redirect_uri" varchar NOT NULL,
	"master_calendar_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "google_calendar_settings_firm_id_unique" UNIQUE("firm_id")
);
--> statement-breakpoint
CREATE TABLE "google_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_id" uuid NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expiry" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "google_tokens_firm_id_unique" UNIQUE("firm_id")
);
--> statement-breakpoint
CREATE TABLE "invoice_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"processed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"invoice_id" varchar NOT NULL,
	"invoice_number" varchar NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"is_paid" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"file_url" varchar NOT NULL,
	"file_name" varchar,
	"file_type" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"change_type" varchar NOT NULL,
	"field_name" varchar,
	"old_value" text,
	"new_value" text,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"priority" varchar DEFAULT 'normal',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"review_text" text,
	"review_document_url" varchar,
	"completed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"shared_by" varchar NOT NULL,
	"shared_with" varchar NOT NULL,
	"permission" varchar DEFAULT 'view',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "project_shares_project_id_shared_with_unique" UNIQUE("project_id","shared_with")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_id" uuid NOT NULL,
	"client_id" integer NOT NULL,
	"leiter_id" varchar NOT NULL,
	"crew_id" integer,
	"start_date" date,
	"end_date" date,
	"status" varchar DEFAULT 'planning' NOT NULL,
	"team_number" varchar,
	"notes" text,
	"invoice_number" varchar,
	"invoice_url" varchar,
	"equipment_expected_date" date,
	"equipment_arrived_date" date,
	"work_start_date" date,
	"work_end_date" date,
	"needs_call_equipment_delay" boolean DEFAULT false,
	"needs_call_crew_delay" boolean DEFAULT false,
	"needs_call_date_change" boolean DEFAULT false,
	"installation_person_first_name" varchar,
	"installation_person_last_name" varchar,
	"installation_person_address" text,
	"installation_person_phone" varchar,
	"installation_person_unique_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"product_key" varchar,
	"description" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"is_custom" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_firms" (
	"user_id" varchar NOT NULL,
	"firm_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar DEFAULT 'leiter' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "calendar_logs" ADD CONSTRAINT "calendar_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_logs" ADD CONSTRAINT "calendar_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crews" ADD CONSTRAINT "crews_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_storage" ADD CONSTRAINT "file_storage_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_storage" ADD CONSTRAINT "file_storage_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_settings" ADD CONSTRAINT "google_calendar_settings_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_tokens" ADD CONSTRAINT "google_tokens_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_queue" ADD CONSTRAINT "invoice_queue_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_history" ADD CONSTRAINT "project_history_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_history" ADD CONSTRAINT "project_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_notes" ADD CONSTRAINT "project_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_notes" ADD CONSTRAINT "project_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_reports" ADD CONSTRAINT "project_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_shares" ADD CONSTRAINT "project_shares_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_shares" ADD CONSTRAINT "project_shares_shared_by_users_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_shares" ADD CONSTRAINT "project_shares_shared_with_users_id_fk" FOREIGN KEY ("shared_with") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_leiter_id_users_id_fk" FOREIGN KEY ("leiter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_firms" ADD CONSTRAINT "user_firms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_firms" ADD CONSTRAINT "user_firms_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");