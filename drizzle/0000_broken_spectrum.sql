CREATE TABLE `activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`actor_user_id` text,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_group_created_idx` ON `activity_events` (`group_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `daily_commitments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`group_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`completed_count` integer DEFAULT 0 NOT NULL,
	`required_count` integer NOT NULL,
	`completed_at` text,
	`deadline` text NOT NULL,
	`penalty_triggered` integer DEFAULT false NOT NULL,
	`waiver_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commitment_user_group_date_unique` ON `daily_commitments` (`user_id`,`group_id`,`date`);--> statement-breakpoint
CREATE INDEX `commitment_deadline_idx` ON `daily_commitments` (`deadline`,`status`);--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`penalty_agreement_at` text NOT NULL,
	`joined_at` text NOT NULL,
	`left_at` text,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_member_unique` ON `group_members` (`group_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`owner_id` text NOT NULL,
	`invite_code` text NOT NULL,
	`daily_required_problems` integer NOT NULL,
	`penalty_per_participant` real NOT NULL,
	`deadline` text NOT NULL,
	`timezone` text NOT NULL,
	`challenge_start_date` text NOT NULL,
	`challenge_end_date` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_invite_code_unique` ON `groups` (`invite_code`);--> statement-breakpoint
CREATE TABLE `penalty_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`failed_user_id` text NOT NULL,
	`recipient_user_id` text NOT NULL,
	`daily_commitment_id` text NOT NULL,
	`amount` real NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text NOT NULL,
	`processed_at` text,
	`payment_provider_transaction_id` text,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`failed_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`daily_commitment_id`) REFERENCES `daily_commitments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `penalty_commitment_recipient_unique` ON `penalty_transactions` (`daily_commitment_id`,`recipient_user_id`);--> statement-breakpoint
CREATE TABLE `problem_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`commitment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`problem_title` text NOT NULL,
	`leetcode_url` text NOT NULL,
	`notes` text,
	`submitted_at` text NOT NULL,
	FOREIGN KEY (`commitment_id`) REFERENCES `daily_commitments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `proof_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`object_key` text NOT NULL,
	`image_url` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`verification_status` text DEFAULT 'UNVERIFIED' NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `problem_submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `streaks` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`total_successful_days` integer DEFAULT 0 NOT NULL,
	`total_failed_days` integer DEFAULT 0 NOT NULL,
	`total_problems_completed` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `streak_user_group_unique` ON `streaks` (`group_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`profile_image` text,
	`timezone` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `waiver_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_id` text NOT NULL,
	`group_id` text NOT NULL,
	`commitment_id` text NOT NULL,
	`date` text NOT NULL,
	`reason_category` text NOT NULL,
	`explanation` text NOT NULL,
	`submitted_at` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`commitment_id`) REFERENCES `daily_commitments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `waiver_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`waiver_id` text NOT NULL,
	`voter_id` text NOT NULL,
	`vote` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`waiver_id`) REFERENCES `waiver_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`voter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `waiver_voter_unique` ON `waiver_votes` (`waiver_id`,`voter_id`);