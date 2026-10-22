import "./globals.css";

export const metadata = {
  title: "Sagar Rajput — A little room on the internet",
  description:
    "Step inside Sagar Rajput's 3D portfolio. PCM student, web developer, and curious builder.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
