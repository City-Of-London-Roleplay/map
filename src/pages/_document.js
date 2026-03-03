import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="UTF-8" />
        <meta httpEquiv="X-UA-Compatible" content="ie=edge" />
        <link rel="icon" href={"/logo.png"} />
        <title>Map | City of London Roleplay</title>
        <meta
          name="description"
          content="Live interactive map for an Emergency Response:Liberty County roleplay server called City of London Roleplay."
        />
        <meta name="theme-color" content="#004433" />
        <meta
          name="keywords"
          content="COL, Interactive Map, City of London Roleplay, COL Map,"
        />
        <meta name="author" content="City Of London" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
