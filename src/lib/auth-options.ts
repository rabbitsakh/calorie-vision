import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import { isAdminEmail } from "@/lib/admin";
import { sanitizeAdapterAccount, sanitizeAdapterUser } from "@/lib/auth-account";
import { resolveAuthRedirect } from "@/lib/auth-url";
import { verifyPhoneOtp } from "@/lib/otp";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
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

if (process.env.EMAIL_SERVER) {
  providers.unshift(
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM ?? "noreply@calorievision.ru",
    }),
  );
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
    createUser(user: AdapterUser) {
      return adapter.createUser!({
        id: user.id,
        ...sanitizeAdapterUser(user as unknown as Record<string, unknown>),
      } as AdapterUser);
    },
    linkAccount(account: AdapterAccount) {
      return adapter.linkAccount!(
        sanitizeAdapterAccount(account as unknown as Record<string, unknown>) as AdapterAccount,
      );
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
