CREATE TABLE `payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_customer_id` text NOT NULL,
	`provider_payment_method_id` text NOT NULL,
	`brand` text NOT NULL,
	`last4` text NOT NULL,
	`expiry_month` integer NOT NULL,
	`expiry_year` integer NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_method_provider_unique` ON `payment_methods` (`provider`,`provider_payment_method_id`);--> statement-breakpoint
CREATE INDEX `payment_method_user_idx` ON `payment_methods` (`user_id`,`status`);