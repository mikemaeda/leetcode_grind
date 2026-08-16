CREATE TABLE `email_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_email_id` text,
	`user_id` text,
	`recipient` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	`last_event_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_deliveries_provider_email_id_unique` ON `email_deliveries` (`provider_email_id`);--> statement-breakpoint
CREATE INDEX `email_delivery_recipient_idx` ON `email_deliveries` (`recipient`,`created_at`);--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`email` text,
	`type` text NOT NULL,
	`ip_address` text,
	`details` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `security_event_created_idx` ON `security_events` (`created_at`,`type`);