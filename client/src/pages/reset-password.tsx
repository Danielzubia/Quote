import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Link, useLocation } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

const forgotPasswordSchema = z.object({
  username: z.string().email("Please enter a valid email address"),
});

export default function ResetPasswordPage() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [submitSuccessful, setSubmitSuccessful] = useState(false);
  
  // If user is already logged in, redirect to home
  if (user) {
    return <Redirect to="/" />;
  }

  // Check if we're on the reset form or verification page
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  // If we have a token, show the reset password form
  if (token) {
    return <ResetPasswordForm token={token} />;
  }

  const form = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      username: "",
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (data: { username: string }) => {
      const res = await apiRequest("POST", "/api/forgot-password", data);
      return await res.json();
    },
    onSuccess: () => {
      setSubmitSuccessful(true);
      toast({
        title: "Password reset request sent",
        description: "If that email exists, you'll receive instructions to reset your password.",
      });
    },
    onError: (error) => {
      toast({
        title: "Request failed",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof forgotPasswordSchema>) => {
    resetMutation.mutate(data);
  };

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Reset your password</CardTitle>
              <CardDescription>
                Enter your email address and we'll send you a link to reset your password
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submitSuccessful ? (
                <div className="space-y-6">
                  <Alert className="bg-green-50 border-green-200">
                    <AlertTitle>Check your email</AlertTitle>
                    <AlertDescription>
                      If an account exists with that email, we've sent instructions to reset your password.
                    </AlertDescription>
                  </Alert>
                  <div className="flex justify-between">
                    <Link to="/auth" className="text-sm text-primary hover:underline">
                      ← Back to login
                    </Link>
                    <Button 
                      variant="ghost"
                      onClick={() => setSubmitSuccessful(false)}
                    >
                      Try again
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Email address</Label>
                    <Input
                      id="username"
                      type="email"
                      {...form.register("username")}
                    />
                    {form.formState.errors.username && (
                      <p className="text-sm text-red-500">
                        {form.formState.errors.username.message}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <Link to="/auth" className="text-sm text-primary hover:underline">
                      ← Back to login
                    </Link>
                    <Button
                      type="submit"
                      disabled={resetMutation.isPending}
                    >
                      {resetMutation.isPending ? "Sending..." : "Send reset link"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}

interface ResetPasswordFormProps {
  token: string;
}

function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [verifyingToken, setVerifyingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenVerified, setTokenVerified] = useState(false);
  const [username, setUsername] = useState("");

  // Schema for the reset password form
  const resetSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  }).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

  const form = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Verify the token when the component mounts
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/reset-password/${token}`);
        const data = await res.json();
        
        if (data.valid) {
          setTokenValid(true);
          setUsername(data.username);
        } else {
          setTokenValid(false);
          toast({
            title: "Invalid or expired link",
            description: "This password reset link is invalid or has expired. Please request a new one.",
            variant: "destructive",
          });
        }
      } catch (error) {
        setTokenValid(false);
        toast({
          title: "Verification failed",
          description: "Could not verify your reset link. Please try again.",
          variant: "destructive",
        });
      } finally {
        setVerifyingToken(false);
        setTokenVerified(true);
      }
    };

    verifyToken();
  }, [token, toast]);

  const resetMutation = useMutation({
    mutationFn: async (data: { password: string }) => {
      const res = await apiRequest("POST", `/api/reset-password/${token}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Password reset successful",
        description: "Your password has been reset successfully. You can now log in with your new password.",
      });
      
      // Redirect to login after a short delay
      setTimeout(() => {
        setLocation("/auth");
      }, 2000);
    },
    onError: (error) => {
      toast({
        title: "Password reset failed",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof resetSchema>) => {
    resetMutation.mutate({ password: data.password });
  };

  if (!tokenVerified || verifyingToken) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md text-center">
            <Card>
              <CardHeader>
                <CardTitle>Verifying your reset link</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center py-4">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
                <p>Please wait while we verify your reset link...</p>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <Card>
              <CardHeader>
                <CardTitle>Invalid or expired link</CardTitle>
              </CardHeader>
              <CardContent>
                <Alert className="bg-red-50 border-red-200 mb-4">
                  <AlertTitle>Reset link is invalid</AlertTitle>
                  <AlertDescription>
                    This password reset link is invalid or has expired.
                  </AlertDescription>
                </Alert>
                <div className="flex justify-between items-center">
                  <Link to="/auth" className="text-sm text-primary hover:underline">
                    ← Back to login
                  </Link>
                  <Link to="/reset-password">
                    <Button>Request new link</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Reset your password</CardTitle>
              <CardDescription>
                Create a new password for {username}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    {...form.register("password")}
                  />
                  {form.formState.errors.password && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    {...form.register("confirmPassword")}
                  />
                  {form.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <Link to="/auth" className="text-sm text-primary hover:underline">
                    ← Back to login
                  </Link>
                  <Button
                    type="submit"
                    disabled={resetMutation.isPending}
                  >
                    {resetMutation.isPending ? "Resetting..." : "Reset password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}
