# Database Schema

CREATE SCHEMA "public";
CREATE TABLE "alembic_version" (
	"version_num" varchar(32),
	CONSTRAINT "alembic_version_pkc" PRIMARY KEY("version_num")
);
CREATE TABLE "card_tags" (
	"card_id" uuid,
	"tag_id" uuid,
	CONSTRAINT "card_tags_pkey" PRIMARY KEY("card_id","tag_id")
);
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"target_text" varchar(500) NOT NULL,
	"target_meaning" varchar(500) NOT NULL,
	"context_sentence" varchar(1000) NOT NULL,
	"context_translation" varchar(1000) NOT NULL,
	"cloze_sentence" varchar(1000) NOT NULL,
	"interval" integer NOT NULL,
	"ease_factor" double precision NOT NULL,
	"next_review" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp NOT NULL
);
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY,
	"email" varchar(255) NOT NULL,
	"hashed_password" varchar(255) NOT NULL,
	"is_active" boolean NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
ALTER TABLE "card_tags" ADD CONSTRAINT "card_tags_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id");
ALTER TABLE "card_tags" ADD CONSTRAINT "card_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id");
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");
CREATE UNIQUE INDEX "alembic_version_pkc" ON "alembic_version" ("version_num");
CREATE UNIQUE INDEX "card_tags_pkey" ON "card_tags" ("card_id","tag_id");
CREATE UNIQUE INDEX "cards_pkey" ON "cards" ("id");
CREATE INDEX "ix_cards_id" ON "cards" ("id");
CREATE INDEX "ix_cards_user_id" ON "cards" ("user_id");
CREATE INDEX "ix_tags_id" ON "tags" ("id");
CREATE INDEX "ix_tags_name" ON "tags" ("name");
CREATE INDEX "ix_tags_user_id" ON "tags" ("user_id");
CREATE UNIQUE INDEX "tags_pkey" ON "tags" ("id");
CREATE UNIQUE INDEX "ix_users_email" ON "users" ("email");
CREATE INDEX "ix_users_id" ON "users" ("id");
CREATE UNIQUE INDEX "users_pkey" ON "users" ("id");