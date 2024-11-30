export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8 p-8 text-center">
        <h2 className="text-3xl font-bold">Check your email</h2>
        <p className="text-muted-foreground">
          We've sent you a verification link. Please check your email to verify
          your account.
        </p>
      </div>
    </div>
  );
}
