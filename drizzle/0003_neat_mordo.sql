CREATE TABLE `payment_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider_customer_id` text NOT NULL,
	`connected_account_id` text,
	`charges_enabled` integer DEFAULT false NOT NULL,
	`payouts_enabled` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_profiles_provider_customer_id_unique` ON `payment_profiles` (`provider_customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_profiles_connected_account_id_unique` ON `payment_profiles` (`connected_account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_profile_user_unique` ON `payment_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `violation_charges` (
	`id` text PRIMARY KEY NOT NULL,
	`daily_commitment_id` text NOT NULL,
	`failed_user_id` text NOT NULL,
	`amount` real NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`provider_payment_intent_id` text,
	`provider_charge_id` text,
	`failure_reason` text,
	`created_at` text NOT NULL,
	`processed_at` text,
	FOREIGN KEY (`daily_commitment_id`) REFERENCES `daily_commitments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`failed_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `violation_charges_provider_payment_intent_id_unique` ON `violation_charges` (`provider_payment_intent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `violation_commitment_unique` ON `violation_charges` (`daily_commitment_id`);