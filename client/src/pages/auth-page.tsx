import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, userValidationSchema } from "@shared/schema";
import { Redirect, useLocation } from "wouter";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { FreshParkingLotImage } from "@/components/parking-lot-image";
import * as z from "zod";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [location] = useLocation();
  
  // Get URL query parameters
  const searchParams = new URLSearchParams(window.location.search);
  const tabParam = searchParams.get('tab');
  const fromPaymentSuccess = searchParams.get('from') === 'payment_success';
  const plan = searchParams.get('plan') || 'pro';
  const paymentEmail = searchParams.get('email') || '';
  
  // Default to register tab if coming from payment success or explicitly set
  const defaultTab = (tabParam === "register" || fromPaymentSuccess) ? "register" : "login";
  
  // Pre-fill the email field if we have it from payment success
  const [prefillEmail, setPrefillEmail] = useState(paymentEmail);

  // Check where the user is coming from
  const [isContractorSignIn] = useState(() => {
    return sessionStorage.getItem('afterLoginAction') === 'viewMap';
  });
  
  // Scroll to top when directed from home page pricing buttons
  useEffect(() => {
    const shouldScrollToTop = sessionStorage.getItem('scrollAuthToTop');
    if (shouldScrollToTop) {
      window.scrollTo(0, 0);
      sessionStorage.removeItem('scrollAuthToTop');
    }
  }, []);
  
  // Check if coming from header sign in
  const [isHeaderSignIn] = useState(() => {
    // If there's no specific afterLoginAction set and we're coming from a route that isn't our own
    const referrer = document.referrer;
    const isFromHeader = !sessionStorage.getItem('afterLoginAction') && 
                         referrer && 
                         referrer.includes(window.location.origin) &&
                         !referrer.includes('/auth');
    
    if (isFromHeader) {
      // Set a flag to indicate this is a header sign in
      sessionStorage.setItem('fromHeader', 'true');
    }
    
    return isFromHeader || sessionStorage.getItem('fromHeader') === 'true';
  });
  
  // Get saved credentials if available and user has previously opted to remember them
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('rememberMe') === 'true';
  });
  
  // Always start with an empty string for better security
  const savedUsername = "";
  
  // Create a React state to track the username for both forms
  const [rememberedUsername, setRememberedUsername] = useState("");
  
  // Only update localStorage when explicitly requested by the Remember Me checkbox
  const saveCredentials = (username: string) => {
    if (rememberMe && username) {
      localStorage.setItem('lastUsername', username);
      localStorage.setItem('rememberMe', 'true');
    }
  };
  
  // Handle remember me changes
  const handleRememberMeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setRememberMe(isChecked);
    localStorage.setItem('rememberMe', isChecked ? 'true' : 'false');
    
    // If unchecked, remove saved credentials
    if (!isChecked) {
      localStorage.removeItem('lastUsername');
    }
  };
  
  // Use our enhanced validation schema that properly validates email addresses
  const loginSchema = userValidationSchema;
  
  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: savedUsername,
      password: "",
    },
  });

  // Extend our email-validated schema to include password confirmation
  const registerSchema = userValidationSchema.extend({
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

  // Use paymentEmail as the default username/email when coming from payment success
  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: paymentEmail || savedUsername,
      password: "",
      confirmPassword: "",
    },
  });
  
  // Effect to update the form when prefillEmail changes (coming from payment success)
  useEffect(() => {
    if (paymentEmail) {
      registerForm.setValue('username', paymentEmail);
    }
  }, [paymentEmail, registerForm]);

  if (user) {
    // Check if the user needs to select a payment plan first
    // Admin users automatically bypass the payment plan screen
    if (user.hasSeenPlanSelection === false && !user.isAdmin) {
      return <Redirect to="/payment-plan" />;
    }
    
    // Clean up the header sign-in flag if it exists
    const fromHeader = sessionStorage.getItem('fromHeader');
    if (fromHeader === 'true') {
      sessionStorage.removeItem('fromHeader');
      // Redirect directly to homepage for header sign-ins
      return <Redirect to="/" />;
    }
    
    // If not from header, check if there's a pending address to redirect to
    const pendingAddress = sessionStorage.getItem('pendingAddress');
    const afterLoginAction = sessionStorage.getItem('afterLoginAction');
    const afterLoginMode = sessionStorage.getItem('afterLoginMode') || 'spaces';
    
    if (pendingAddress) {
      // Clean up session storage
      sessionStorage.removeItem('pendingAddress');
      sessionStorage.removeItem('afterLoginAction');
      sessionStorage.removeItem('afterLoginMode');
      
      // If coming from "Contractor Sign In" flow, we go to the map view
      if (afterLoginAction === 'viewMap') {
        const encodedAddress = encodeURIComponent(pendingAddress);
        return <Redirect to={`/map?address=${encodedAddress}&mode=${afterLoginMode}`} />;
      }
      
      // Otherwise use default behavior (legacy format support)
      return <Redirect to={`/map?address=${encodeURIComponent(pendingAddress)}&mode=${afterLoginMode}`} />;
    }
    
    // No pending address, go to home
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="grid grid-cols-1 md:grid-cols-2 flex-1 py-12">
        <div className="flex items-center justify-center pl-8 pr-4 py-8 h-[530px]">
          <div className="w-full max-w-sm">
            <Tabs defaultValue={defaultTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Card>
                  <CardHeader>
                    <CardTitle>Welcome back</CardTitle>
                    <CardDescription>
                      Sign in to access your account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={loginForm.handleSubmit((data) =>
                        loginMutation.mutate(data)
                      )}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="username">Email Address</Label>
                        <Input
                          id="username"
                          type="email"
                          placeholder="your.email@example.com"
                          {...loginForm.register("username", {
                            onChange: (e) => setRememberedUsername(e.target.value)
                          })}
                        />
                        {loginForm.formState.errors.username && (
                          <p className="text-sm text-red-500">
                            {loginForm.formState.errors.username.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          {...loginForm.register("password")}
                        />
                        {loginForm.formState.errors.password && (
                          <p className="text-sm text-red-500">
                            {loginForm.formState.errors.password.message}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="remember-me"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={rememberMe}
                          onChange={handleRememberMeChange}
                        />
                        <Label htmlFor="remember-me" className="text-sm font-normal">
                          Remember my username
                        </Label>
                      </div>
                      
                      {loginMutation.isError && (
                        <div className="text-sm text-red-500 p-2 bg-red-50 rounded-md">
                          Invalid username or password. Please try again.
                        </div>
                      )}
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={loginMutation.isPending}
                        onClick={() => saveCredentials(loginForm.getValues().username)}
                      >
                        Sign In
                      </Button>
                      <div className="text-center mt-4">
                        <Link to="/reset-password" className="text-sm text-primary hover:underline">
                          Forgot your password?
                        </Link>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="register">
                {fromPaymentSuccess && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                    <h3 className="font-semibold text-green-800 mb-1">Payment Successful!</h3>
                    <p className="text-sm text-green-700 mb-2">
                      Your {plan.charAt(0).toUpperCase() + plan.slice(1)} plan subscription has been confirmed. Create your account now to access all features.
                    </p>
                    <p className="text-xs text-green-600">
                      Make sure to use the same email address you used during checkout for a seamless experience.
                    </p>
                  </div>
                )}
                <Card>
                  <CardHeader>
                    <CardTitle>Create an account</CardTitle>
                    <CardDescription>
                      Sign up to get started with our services
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={registerForm.handleSubmit((data) =>
                        registerMutation.mutate(data)
                      )}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="reg-username">Email Address</Label>
                        <Input
                          id="reg-username"
                          type="email"
                          placeholder="your.email@example.com"
                          {...registerForm.register("username", {
                            onChange: (e) => setRememberedUsername(e.target.value)
                          })}
                        />
                        {registerForm.formState.errors.username && (
                          <p className="text-sm text-red-500">
                            {registerForm.formState.errors.username.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-password">Password</Label>
                        <Input
                          id="reg-password"
                          type="password"
                          {...registerForm.register("password")}
                        />
                        {registerForm.formState.errors.password && (
                          <p className="text-sm text-red-500">
                            {registerForm.formState.errors.password.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-confirm-password">Confirm Password</Label>
                        <Input
                          id="reg-confirm-password"
                          type="password"
                          {...registerForm.register("confirmPassword")}
                        />
                        {registerForm.formState.errors.confirmPassword && (
                          <p className="text-sm text-red-500">
                            {registerForm.formState.errors.confirmPassword.message}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mb-4">
                        <input
                          type="checkbox"
                          id="remember-me-register"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={rememberMe}
                          onChange={handleRememberMeChange}
                        />
                        <Label htmlFor="remember-me-register" className="text-sm font-normal">
                          Remember my username
                        </Label>
                      </div>
                      
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={registerMutation.isPending}
                        onClick={() => saveCredentials(registerForm.getValues().username)}
                      >
                        Sign Up
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div className="hidden md:block relative h-[530px]">
          <div className="flex items-center h-full pl-0 pr-8 py-6">
            <div className="relative w-[600px] h-[450px] rounded-lg overflow-hidden shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/50">
                <img
                  src="/images/parking-lot.png"
                  alt="Freshly Sealcoated Parking Lot"
                  className="w-full h-full object-cover mix-blend-overlay"
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="max-w-md text-white text-center">
                  <h2 className="text-3xl font-bold mb-4">
                    LotQuote Professional Services
                  </h2>
                  <p className="text-base opacity-90">
                    Get instant estimates and manage your parking lot maintenance needs
                    all in one place.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}