// Client-side Supabase instance
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

// Create Supabase client with persistence enabled
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true  // Keep user logged in between page refreshes
  }
});

// Function to create a bucket if it doesn't exist
export async function ensureBucketExists(bucketName: string, isPublic: boolean = true) {
  try {
    // Check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`Creating bucket: ${bucketName}`);
      const { data, error } = await supabase.storage.createBucket(bucketName, {
        public: isPublic
      });
      
      if (error) {
        console.error(`Error creating bucket ${bucketName}:`, error);
        return false;
      }
      
      console.log(`Successfully created bucket: ${bucketName}`);
      return true;
    }
    
    return true; // Bucket already exists
  } catch (error) {
    console.error('Error in ensureBucketExists:', error);
    return false;
  }
}

// Function to upload a file to a bucket and get a public URL
export async function uploadScreenshot(screenshot: string | HTMLCanvasElement, name: string): Promise<string | null> {
  try {
    // First ensure the bucket exists
    const bucketName = 'screenshots';
    const bucketCreated = await ensureBucketExists(bucketName, true);
    
    if (!bucketCreated) {
      throw new Error('Failed to create or verify bucket');
    }
    
    // Create a unique filename
    const fileName = `quote_${Date.now()}_${name.replace(/\s+/g, '_')}.png`;
    
    // If the screenshot is a data URL, convert it to a blob first
    if (typeof screenshot === 'string' && screenshot.startsWith('data:')) {
      try {
        // Convert base64 to blob for browser environment
        const blob = await fetch(screenshot).then(res => res.blob());
        console.log('Created blob from data URL:', blob); // Log the blob details
        
        // Upload the file
        const { data, error } = await supabase.storage
          .from(bucketName)
          .upload(fileName, blob, {
            contentType: 'image/png',
            upsert: true
          });
        
        if (error) {
          console.error('Error uploading screenshot blob:', error);
          return null;
        }
        
        // Get the public URL using the correct format
        const { data: publicData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);
        
        console.log('Generated public URL for screenshot blob:', publicData.publicUrl);
        return publicData.publicUrl;
      } catch (blobError) {
        console.error('Error processing blob from data URL:', blobError);
        return null;
      }
    } else if (screenshot instanceof HTMLCanvasElement) {
      // If it's a canvas element, use a better approach with toBlob
      console.log('Processing HTMLCanvasElement for screenshot upload');
      return new Promise<string | null>((resolve) => {
        screenshot.toBlob(async (blob) => {
          if (!blob) {
            console.error('Canvas toBlob failed to create a blob');
            resolve(null);
            return;
          }
          
          console.log('Created blob from canvas:', blob); // Log the blob details

          try {
            const { data, error } = await supabase.storage
              .from(bucketName)
              .upload(fileName, blob, {
                contentType: 'image/png',
                upsert: true,
              });

            if (error) {
              console.error('Error uploading canvas blob:', error);
              resolve(null);
              return;
            }

            const { data: publicData } = supabase
              .storage
              .from(bucketName)
              .getPublicUrl(data.path);

            console.log('Generated public URL for canvas blob:', publicData.publicUrl);
            resolve(publicData.publicUrl);
          } catch (uploadError) {
            console.error('Error in canvas blob upload:', uploadError);
            resolve(null);
          }
        }, 'image/png');
      });
    }
    
    // Fallback for unexpected input type
    console.error('Unsupported screenshot input type');
    return null;
  } catch (error) {
    console.error('Error in uploadScreenshot:', error);
    return null;
  }
}
