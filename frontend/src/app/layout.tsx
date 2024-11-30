import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Dead Man's Switch",
  description: "Secure your digital legacy",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-background min-h-screen`}>
        <main className="container mx-auto px-4">{children}</main>
      </body>
    </html>
  );
}
