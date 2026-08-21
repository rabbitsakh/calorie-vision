import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import { isAdminEmail } from "@/lib/admin";
import {
  isBlankAuthEmail,
  isPrismaUniqueConflict,
  oauthUserCreateId,
  sanitizeAdapterAccount,
  sanitizeAdapterUser,
} from "@/lib/auth-account";
import { resolveAuthRedirect } from "@/lib/auth-url";
import { isEmailLoginConfigured, resolveEmailServer, sendMagicLinkEmail } from "@/lib/email-auth";
import { verifyPhoneOtp } from "@/lib/otp";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import {
  findOrCreateTelegramUser,
  isTelegramLoginConfigured,
  verifyTelegramAuth,
  type TelegramAuthPayload,
} from "@/lib/telegram-auth";
import { createVkIdProvider } from "@/lib/vk-auth";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    id: "phone",
    name: "Phone",
    credentials: {
      phone: { label: "Телефон", type: "text" },
      code: { label: "Код", type: "text" },
    },
    async authorize(credentials) {
      const phone = normalizePhone(credentials?.phone ?? "");
      const code = credentials?.code?.trim();

      if (!phone || !code || !isValidPhone(phone)) {
        return null;
      }

      const valid = await verifyPhoneOtp(phone, code);
      if (!valid) {
        return null;
      }

      let user = await prisma.user.findUnique({ where: { phone } });
      if (!user) {
        user = await prisma.user.create({
          data: { phone, phoneVerified: new Date() },
        });
      } else if (!user.phoneVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { phoneVerified: new Date() },
        });
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },
  }),
];

if (isTelegramLoginConfigured() && process.env.TELEGRAM_BOT_TOKEN) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  providers.push(
    CredentialsProvider({
      id: "telegram",
      name: "Telegram",
      credentials: {
        id: { label: "id", type: "text" },
        first_name: { label: "first_name", type: "text" },
        last_name: { label: "last_name", type: "text" },
        username: { label: "username", type: "text" },
        photo_url: { label: "photo_url", type: "text" },
        auth_date: { label: "auth_date", type: "text" },
        hash: { label: "hash", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.id || !credentials.hash || !credentials.auth_date) {
          return null;
        }

        const payload: TelegramAuthPayload = {
          id: credentials.id,
          first_name: credentials.first_name || undefined,
          last_name: credentials.last_name || undefined,
          username: credentials.username || undefined,
          photo_url: credentials.photo_url || undefined,
          auth_date: credentials.auth_date,
          hash: credentials.hash,
        };

        if (!verifyTelegramAuth(payload, botToken)) {
          return null;
        }

        const user = await findOrCreateTelegramUser(payload);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  );
}

if (isEmailLoginConfigured()) {
  const server = resolveEmailServer();
  if (server) {
    providers.unshift(
      EmailProvider({
        server,
        from: process.env.EMAIL_FROM ?? "noreply@calorievision.ru",
        maxAge: 24 * 60 * 60,
        async sendVerificationRequest(params) {
          try {
            await sendMagicLinkEmail({
              identifier: params.identifier,
              url: params.url,
              provider: {
                server: params.provider.server,
                from: params.provider.from,
              },
            });
          } catch (error) {
            console.error("[email-auth] Failed to send magic link:", error);
            throw new Error("Не удалось отправить письмо для входа. Проверьте SMTP на сервере.");
          }
        },
      }),
    );
  }
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (process.env.VK_CLIENT_ID) {
  providers.push(
    createVkIdProvider({
      clientId: process.env.VK_CLIENT_ID,
      clientSecret: process.env.VK_CLIENT_SECRET,
    }),
  );
}

function createAuthAdapter(): Adapter {
  const adapter = PrismaAdapter(prisma) as Adapter;

  return {
    ...adapter,
    async createUser(user: AdapterUser) {
      const data = {
        ...sanitizeAdapterUser(user as unknown as Record<string, unknown>),
      };
      const id = oauthUserCreateId(user);

      if (id) {
        const existing = await prisma.user.findUnique({ where: { id } });
        if (existing) {
          return existing;
        }
      }

      try {
        return await prisma.user.create({
          data: id ? { id, ...data } : data,
        });
      } catch (error) {
        if (id && isPrismaUniqueConflict(error)) {
          const existing = await prisma.user.findUnique({ where: { id } });
          if (existing) {
            return existing;
          }
        }
        throw error;
      }
    },
    async getUserByEmail(email) {
      if (isBlankAuthEmail(email)) {
        return null;
      }
      return adapter.getUserByEmail!(email);
    },
    async getUserByAccount(providerAccount) {
      return adapter.getUserByAccount!({
        provider: providerAccount.provider,
        providerAccountId: String(providerAccount.providerAccountId),
      });
    },
    async linkAccount(account: AdapterAccount) {
      const data = sanitizeAdapterAccount(account as unknown as Record<string, unknown>);
      try {
        return await adapter.linkAccount!(data as AdapterAccount);
      } catch (error) {
        if (!isPrismaUniqueConflict(error) || !data.provider || !data.providerAccountId) {
          throw error;
        }

        const existing = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: String(data.provider),
              providerAccountId: String(data.providerAccountId),
            },
          },
        });
        if (existing) {
          return existing as AdapterAccount;
        }
        throw error;
      }
    },
  };
}

export const authOptions: NextAuthOptions = {
  adapter: createAuthAdapter(),
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/login",
  },
  callbacks: {
    async redirect({ url }) {
      return resolveAuthRedirect(url);
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        const user = await prisma.user.findUnique({ where: { id: token.id as string } });
        if (user) {
          session.user.email = user.email;
          session.user.phone = user.phone;
          session.user.name = user.name ?? session.user.name;
          session.user.image = user.image ?? session.user.image;
          session.user.isAdmin = isAdminEmail(user.email);
        }
      }
      return session;
    },
  },
};
