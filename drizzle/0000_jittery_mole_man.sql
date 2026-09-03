CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_decisions_owner` ON `decisions` (`owner`);--> statement-breakpoint
CREATE TABLE `quotas` (
	`owner` text NOT NULL,
	`bucket` integer NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`owner`, `bucket`)
);
--> statement-breakpoint
CREATE TABLE `revisions` (
	`decision_id` text NOT NULL,
	`revision` integer NOT NULL,
	`parent_digest` text NOT NULL,
	`digest` text NOT NULL,
	`snapshot` text NOT NULL,
	`title` text NOT NULL,
	`created_at` text NOT NULL,
	`note` text NOT NULL,
	`request_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	PRIMARY KEY(`decision_id`, `revision`),
	FOREIGN KEY (`decision_id`) REFERENCES `decisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_revisions_request` ON `revisions` (`decision_id`,`request_id`);