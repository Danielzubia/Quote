import { supabase } from './supabase';

export async function signUp(email: string, password: string, firstName?: string, lastName?: string) {
  // First check if user already exists in auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      },
      emailRedirectTo: undefined
    }
  });

  // If user already exists in auth, try to sign them in instead
  if (authError && authError.status === 422 && authError.code === 'user_already_exists') {
    console.log('User already exists in Supabase auth, attempting sign in');
    
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (signInError) {
      throw new Error('Email already registered but password is incorrect. Please try logging in instead.');
    }
    
    // Use the sign-in data instead
    return { data: signInData, error: null };
  }

  if (authError) throw authError;

  if (authData.user) {
    // Create profile as the authenticated user - check if already exists first
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', authData.user.id)
      .single();

    if (!existingUser) {
      const { error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            email: authData.user.email,
            first_name: firstName,
            last_name: lastName,
            plan: 'free',
            registration_status: 'active'
          }
        ]);

      if (profileError) {
        console.error('Error creating profile:', profileError);
        throw new Error('Failed to create user profile');
      }
      console.log('Successfully created user profile in Supabase users table');
    } else {
      console.log('User profile already exists in Supabase users table');
    }
  }

  return { data: authData, error: null };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return { data, error: null };
}
