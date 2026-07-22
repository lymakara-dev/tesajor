import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  telegramAccounts,
} from "@/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTelegramAuth } from "@/lib/telegram/verify";
import { loginSchema } from "@/lib/validation/auth";
import { telegramWidgetAuthSchema } from "@/lib/validation/telegram";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google,
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (rawCredentials, request) => {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (!checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) return null;

        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user?.passwordHash) return null;

        const passwordMatches = await bcrypt.compare(
          password,
          user.passwordHash,
        );
        if (!passwordMatches) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
    // "Sign in with Telegram" via the Login Widget. This verifies identity
    // (HMAC-signed by Telegram) but does NOT provide a chat_id — messaging
    // capability still requires the deep-link flow in
    // src/lib/actions/telegram.ts::createTelegramLinkToken.
    Credentials({
      id: "telegram",
      name: "Telegram",
      credentials: {
        id: {},
        first_name: {},
        last_name: {},
        username: {},
        photo_url: {},
        auth_date: {},
        hash: {},
      },
      authorize: async (rawCredentials) => {
        const parsed = telegramWidgetAuthSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) return null;

        const verification = verifyTelegramAuth(parsed.data, botToken);
        if (!verification.ok) return null;

        const telegramUserId = String(parsed.data.id);

        const [existingAccount] = await db
          .select()
          .from(telegramAccounts)
          .where(eq(telegramAccounts.telegramUserId, telegramUserId))
          .limit(1);

        if (existingAccount) {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, existingAccount.userId))
            .limit(1);
          if (!user) return null;
          return { id: user.id, name: user.name, email: user.email, image: user.image };
        }

        const displayName =
          [parsed.data.first_name, parsed.data.last_name].filter(Boolean).join(" ") ||
          parsed.data.username ||
          "Telegram user";

        const [newUser] = await db
          .insert(users)
          .values({
            name: displayName,
            email: `telegram-${telegramUserId}@telegram.tesajor.local`,
            image: parsed.data.photo_url,
          })
          .returning();

        await db.insert(telegramAccounts).values({
          userId: newUser.id,
          telegramUserId,
          username: parsed.data.username,
        });

        return { id: newUser.id, name: newUser.name, email: newUser.email, image: newUser.image };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) token.sub = user.id;
      // Populated by useSession().update({ name, image }) after a profile
      // edit — without this, the JWT keeps showing the name/avatar from
      // the moment the user last signed in.
      if (trigger === "update" && session) {
        if (typeof session.name === "string") token.name = session.name;
        if ("image" in session) token.picture = session.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
