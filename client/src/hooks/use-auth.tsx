import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/utils/supabase-client";


type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
  supabaseUser: any;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  
  // Check for existing Supabase session on load
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSupabaseUser(session?.user || null);
      }
    );
    
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user || null);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      try {
        // Store the username in localStorage for persistence
        localStorage.setItem('lastUsername', credentials.username);
        
        // Try to authenticate with Supabase first
        const { data: supabaseData, error: supabaseError } = await supabase.auth.signInWithPassword({
          email: credentials.username, // Using email as username
          password: credentials.password,
        });
        
        if (supabaseData.user) {
          console.log('Supabase login successful, now getting user data from our API');
          // Auth successful with Supabase, now get our user from the API
          const res = await apiRequest("POST", "/api/login", credentials);
          
          if (!res.ok) {
            throw new Error(`Login successful with Supabase but failed with our API: ${res.status}`);
          }
          
          return await res.json();
        }
        
        // If Supabase login fails, fall back to our regular login
        console.log('Supabase login failed, falling back to regular login');
        const res = await apiRequest("POST", "/api/login", credentials);
        
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error('Invalid username or password');
          }
          throw new Error(`Login failed with status: ${res.status}`);
        }
        
        return await res.json();
      } catch (error) {
        console.error("Login error:", error);
        // Make sure we're always throwing an error
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('An unknown error occurred during login');
      }
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      // Refresh authentication state
      queryClient.invalidateQueries({queryKey: ["/api/user"]});
    },
    onError: (error: Error) => {
      console.error("Login error:", error);
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      try {
        // Store the username in localStorage on registration too
        localStorage.setItem('lastUsername', credentials.username);
        
        // Make sure we're using a valid, properly formatted email address
        // Let Supabase handle the actual email validation
        if (!credentials.username.includes('@') || !credentials.username.includes('.')) {
          throw new Error('Please enter a valid email address');
        }
        
        // Make sure the email is trimmed and lowercase to avoid validation issues
        const email = credentials.username.trim().toLowerCase();
        
        // Very basic email check - only check for @ and .
        if (!email.includes('@') || !email.includes('.')) {
          throw new Error('Please enter a valid email address');
        }
        
        // Log the email we're trying to use
        console.log('Attempting to register with email:', email);
        
        // Register with Supabase auth and create user profile in one step
        const { data: supabaseData, error: supabaseError } = await supabase.auth.signUp({
          email: email,
          password: credentials.password,
          options: {
            data: {
              first_name: credentials.firstName || '',
              last_name: credentials.lastName || '',
            }
          }
        });
        
        // Note: User profile creation will be handled by the server-side registration endpoint
        // to avoid duplicate registrations
        
        // If Supabase indicates the user needs confirmation, we need to adapt
        if (supabaseData.user) {
          console.log('User created in Supabase, proceeding with direct sign-in');
          
          // Optionally you can disable this auto-login if it causes issues
          // and just proceed with API registration directly
          try {
            // Force immediate authentication
            await supabase.auth.signInWithPassword({
              email: email,
              password: credentials.password
            });
          } catch (signInError) {
            console.warn('Auto sign-in failed, but continuing with registration:', signInError);
            // We'll continue with registration even if this fails
          }
        }
        
        if (supabaseError) {
          console.error('Supabase registration error:', supabaseError);
          
          // Special handling for "user already exists" error
          // Check for the specific error codes and messages
          if ((supabaseError.status === 422 || 
               supabaseError.status === 400) && 
              (supabaseError.message?.includes('already registered') || 
               supabaseError.message?.includes('already exists') ||
               supabaseError.code === 'user_already_exists')) {
            
            console.log('User already exists in Supabase, attempting to sign in directly');
            
            // Try to sign in directly if the user already exists
            try {
              const signInResult = await supabase.auth.signInWithPassword({
                email: email,
                password: credentials.password
              });
              
              if (signInResult.error) {
                console.error('Failed to sign in existing user:', signInResult.error);
                throw new Error('This email is already registered but the password is incorrect. Please try logging in instead.');
              }
              
              // Successfully signed in, continue with the registration flow
              console.log('Successfully signed in existing user');
              
              // Use the signInResult data for API registration
              if (signInResult.data.user) {
                const supabaseUserId = signInResult.data.user.id;
                
                // Create API credentials with the Supabase ID
                const apiCredentials = {
                  ...credentials,
                  supabaseId: supabaseUserId
                };
                
                console.log('Registering user in our database with existing Supabase account:', apiCredentials);
                
                // Register with our API to create the user in our system
                const apiRes = await apiRequest("POST", "/api/register", apiCredentials);
                
                if (!apiRes.ok) {
                  const errorData = await apiRes.json();
                  throw new Error(errorData.message || `API registration failed with status: ${apiRes.status}`);
                }
                
                // Return the user data from our API
                return await apiRes.json();
              }
            } catch (signInError) {
              console.error('Error during sign-in of existing user:', signInError);
              throw new Error('This email is already registered. Please use the login form instead.');
            }
          } else {
            // For other errors, throw the original error
            throw new Error(supabaseError.message || 'Failed to register with Supabase');
          }
        }
        
        // If successful with Supabase, register with our API and include the Supabase user ID
        const supabaseUserId = supabaseData.user?.id;
        
        const apiCredentials = {
          ...credentials,
          supabaseId: supabaseUserId
        };
        
        const res = await apiRequest("POST", "/api/register", apiCredentials);
        
        if (!res.ok) {
          throw new Error(`API registration failed with status: ${res.status}`);
        }
        
        return await res.json();
      } catch (error) {
        console.error("Registration error:", error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('An unknown error occurred during registration');
      }
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Sign out from Supabase
      await supabase.auth.signOut();
      // Also sign out from our API
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        supabaseUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
