import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/lexend";
import "@fontsource/lora";
import "@fontsource/merriweather";
import "./globals.css";

export const metadata: Metadata = {
  title: "FieldOps - Construction Cost and Revenue Analysis",
  description: "Professional field operations and project management platform",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-inter" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}