CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`enquiry_id` text NOT NULL,
	`slot_id` text NOT NULL,
	`vehicle_id` text,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`enquiry_id`) REFERENCES `enquiries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`slot_id`) REFERENCES `slots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "appointments_status_check" CHECK("appointments"."status" in ('confirmed','cancelled','completed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_one_confirmed_slot` ON `appointments` (`slot_id`) WHERE "appointments"."status" = 'confirmed';--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_one_confirmed_enquiry` ON `appointments` (`enquiry_id`) WHERE "appointments"."status" = 'confirmed';--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `enquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`vehicle_id` text,
	`vehicle_label` text NOT NULL,
	`customer_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`request_type` text NOT NULL,
	`preferred_date` text,
	`requested_slot_id` text,
	`message` text DEFAULT '' NOT NULL,
	`consent_at` text NOT NULL,
	`receipt_token_hash` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`payload_hash` text NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_slot_id`) REFERENCES `slots`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "enquiries_request_type_check" CHECK("enquiries"."request_type" in ('test-drive','details','reservation')),
	CONSTRAINT "enquiries_status_check" CHECK("enquiries"."status" in ('new','contacted','appointment-confirmed','closed','reserved','payment-review'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enquiries_reference_unique` ON `enquiries` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `enquiries_idempotency_unique` ON `enquiries` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `enquiries_status_created_idx` ON `enquiries` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`enquiry_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`amount_kes` integer NOT NULL,
	`currency` text DEFAULT 'KES' NOT NULL,
	`status` text DEFAULT 'initiating' NOT NULL,
	`checkout_url` text,
	`provider_transaction_id` text,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`verified_at` text,
	FOREIGN KEY (`enquiry_id`) REFERENCES `enquiries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payments_amount_check" CHECK("payments"."amount_kes" > 0),
	CONSTRAINT "payments_status_check" CHECK("payments"."status" in ('initiating','pending','paid','review','failed','expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_reference_unique` ON `payments` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_provider_id_unique` ON `payments` (`provider_transaction_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_one_active_vehicle` ON `payments` (`vehicle_id`) WHERE "payments"."status" in ('initiating','pending','paid');--> statement-breakpoint
CREATE INDEX `payments_enquiry_idx` ON `payments` (`enquiry_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "settings_valid_json" CHECK(json_valid("settings"."value"))
);
--> statement-breakpoint
CREATE TABLE `slots` (
	`id` text PRIMARY KEY NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "slots_status_check" CHECK("slots"."status" in ('open','closed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slots_starts_at_unique` ON `slots` (`starts_at`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`stock_number` text NOT NULL,
	`data` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`condition` text DEFAULT 'used' NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`payment_hold_id` text,
	`hold_expires_at` text,
	`reserved_payment_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "vehicles_status_check" CHECK("vehicles"."status" in ('available','reserved','sold','draft','archived')),
	CONSTRAINT "vehicles_condition_check" CHECK("vehicles"."condition" in ('new','used')),
	CONSTRAINT "vehicles_data_json" CHECK(json_valid("vehicles"."data"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_stock_number_unique` ON `vehicles` (`stock_number`);--> statement-breakpoint
CREATE INDEX `vehicles_status_idx` ON `vehicles` (`status`);