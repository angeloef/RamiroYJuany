CREATE TYPE "public"."estado_comentario" AS ENUM('publicado', 'oculto');--> statement-breakpoint
CREATE TYPE "public"."estado_evento" AS ENUM('borrador', 'activo', 'cerrado');--> statement-breakpoint
CREATE TYPE "public"."estado_foto" AS ENUM('pendiente', 'publicada', 'oculta', 'eliminada');--> statement-breakpoint
CREATE TYPE "public"."tipo_reaccion" AS ENUM('corazon', 'risa', 'fiesta', 'emocion');--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"guest_token_id" uuid NOT NULL,
	"texto" text NOT NULL,
	"estado" "estado_comentario" DEFAULT 'publicado' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"fecha" date NOT NULL,
	"timezone" text DEFAULT 'America/Argentina/Buenos_Aires' NOT NULL,
	"estado" "estado_evento" DEFAULT 'borrador' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "guest_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"token" text NOT NULL,
	"label" text NOT NULL,
	"usos" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"revocado_en" timestamp with time zone,
	CONSTRAINT "guest_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"guest_token_id" uuid NOT NULL,
	"key_original" text NOT NULL,
	"key_web" text NOT NULL,
	"key_thumb" text NOT NULL,
	"derivadas" boolean DEFAULT true NOT NULL,
	"mime" text NOT NULL,
	"bytes" bigint NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"phash" text,
	"taken_at" timestamp with time zone,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"caption" text,
	"exif" jsonb,
	"estado" "estado_foto" DEFAULT 'publicada' NOT NULL,
	"orden" integer
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"photo_id" uuid NOT NULL,
	"guest_token_id" uuid NOT NULL,
	"tipo" "tipo_reaccion" NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_photo_id_guest_token_id_tipo_pk" PRIMARY KEY("photo_id","guest_token_id","tipo")
);
--> statement-breakpoint
CREATE TABLE "view_events" (
	"photo_id" uuid NOT NULL,
	"dia" date NOT NULL,
	"cantidad" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "view_events_photo_id_dia_pk" PRIMARY KEY("photo_id","dia")
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_guest_token_id_guest_tokens_id_fk" FOREIGN KEY ("guest_token_id") REFERENCES "public"."guest_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_tokens" ADD CONSTRAINT "guest_tokens_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_guest_token_id_guest_tokens_id_fk" FOREIGN KEY ("guest_token_id") REFERENCES "public"."guest_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_guest_token_id_guest_tokens_id_fk" FOREIGN KEY ("guest_token_id") REFERENCES "public"."guest_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_events" ADD CONSTRAINT "view_events_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_photo_idx" ON "comments" USING btree ("photo_id","creado_en");--> statement-breakpoint
CREATE INDEX "guest_tokens_event_idx" ON "guest_tokens" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "photos_feed_idx" ON "photos" USING btree ("event_id","estado",coalesce("taken_at", "uploaded_at") desc);--> statement-breakpoint
CREATE INDEX "photos_dedup_idx" ON "photos" USING btree ("event_id","phash");--> statement-breakpoint
CREATE INDEX "photos_token_idx" ON "photos" USING btree ("guest_token_id");