import type { FastifyInstance } from "fastify";
import { supabase, supabaseAdmin } from "@ditch/db";
import { authenticate } from "../lib/authenticate";

interface SignupBody {
  email: string;
  password: string;
  display_name?: string;
}

interface SigninBody {
  email: string;
  password: string;
}

export async function authRoutes(server: FastifyInstance) {
  /**
   * POST /auth/signup
   *
   * Creates a new Supabase auth user. The handle_new_user trigger
   * automatically creates the matching public.users profile row.
   *
   * Body:   { email, password, display_name? }
   * Return: 201 { user: { id, email, display_name } }
   */
  server.post<{ Body: SignupBody }>(
    "/auth/signup",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email:        { type: "string", format: "email" },
            password:     { type: "string", minLength: 8 },
            display_name: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { email, password, display_name } = request.body;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: display_name ?? email.split("@")[0] },
        },
      });

      if (error) {
        const status = error.status ?? 400;
        return reply.status(status).send({ error: error.message });
      }

      if (!data.user) {
        return reply.status(400).send({ error: "Signup failed — no user returned" });
      }

      return reply.status(201).send({
        user: {
          id:           data.user.id,
          email:        data.user.email,
          display_name: data.user.user_metadata?.display_name ?? null,
        },
      });
    }
  );

  /**
   * POST /auth/signin
   *
   * Signs in with email + password. Returns Supabase session tokens.
   * The client should store access_token and send it as:
   *   Authorization: Bearer <access_token>
   *
   * Body:   { email, password }
   * Return: 200 { access_token, refresh_token, expires_in, user: { id, email, display_name } }
   */
  server.post<{ Body: SigninBody }>(
    "/auth/signin",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email:    { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const status = error.status ?? 401;
        return reply.status(status).send({ error: error.message });
      }

      return reply.status(200).send({
        access_token:  data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in:    data.session.expires_in,
        user: {
          id:           data.user.id,
          email:        data.user.email,
          display_name: data.user.user_metadata?.display_name ?? null,
        },
      });
    }
  );

  /**
   * POST /auth/signout
   *
   * Revokes the caller's Supabase session server-side.
   * Auth required — the token being signed out must be presented.
   *
   * Return: 200 { success: true }
   */
  server.post(
    "/auth/signout",
    { preHandler: authenticate },
    async (request, reply) => {
      await supabaseAdmin!.auth.admin.signOut(request.user.id);
      return reply.status(200).send({ success: true });
    }
  );
}
