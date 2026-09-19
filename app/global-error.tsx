"use client";

/**
 * Last-resort boundary for errors thrown by the root layout itself. It replaces
 * the whole document, so it cannot rely on the app's styles or providers.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          margin: 0,
          padding: "4rem 1.5rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.125rem", margin: 0 }}>Clinic Assistant is unavailable</h1>
        <p style={{ color: "#57534e", marginTop: "0.75rem" }}>
          The application failed to start. Please try again.
        </p>
        {error.digest && (
          <p style={{ color: "#78716c", fontSize: "0.8rem" }}>Reference: {error.digest}</p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "0.75rem",
            border: "1px solid #d6d3d1",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}