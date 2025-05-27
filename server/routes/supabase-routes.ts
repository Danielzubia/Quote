import { Router } from 'express';
import { supabase } from '../supabase';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

// Submit quote endpoint
router.post('/submit-quote', async (req, res) => {
  const { name, email, address, quoteData, userType = 'free', screenshot, screenshotUrl: providedScreenshotUrl } = req.body;

  try {
    let screenshotUrl = providedScreenshotUrl || null;
    
    // Use the provided screenshotUrl if available, otherwise try to use the processed image file
    if (!screenshotUrl) {
      // Try to get the processed image file directly if a processedImageId is available
      if (quoteData && quoteData.processedImageId) {
        console.log(`Attempting to access processed image with ID: ${quoteData.processedImageId}`);
        try {
          const processedImagePath = path.join(process.cwd(), 'tmp', 'processed', `${quoteData.processedImageId}.jpg`);
          console.log(`Constructed image path: ${processedImagePath}`);
          
          // List files in tmp/processed to check what's available
          try {
            const processedDir = path.join(process.cwd(), 'tmp', 'processed');
            console.log(`Checking directory: ${processedDir}`);
            const files = await fs.readdir(processedDir);
            console.log(`Files in tmp/processed directory:`, files);
          } catch (dirErr) {
            console.error(`Error listing files in tmp/processed:`, dirErr);
          }
          
          try {
            // Check if the file exists
            await fs.access(processedImagePath);
            
            console.log(`Found processed image file: ${processedImagePath}`);
            
            // Read the image file
            const imageBuffer = await fs.readFile(processedImagePath);
            console.log(`Read image file successfully, size: ${imageBuffer.length} bytes`);
            
            // Upload the image to Supabase using the screenshots bucket
            const bucketName = 'screenshots';
            
            // Try to upload the image
            try {
              // Check if bucket exists and create if necessary
              const { data: buckets } = await supabase.storage.listBuckets();
              const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
              
              if (!bucketExists) {
                console.log(`Creating bucket: ${bucketName}`);
                const { error: createError } = await supabase.storage.createBucket(bucketName, {
                  public: true
                });
                
                if (createError) {
                  throw new Error(`Could not create bucket: ${createError.message}`);
                }
              }
              
              // Upload the file
              const fileName = `quote_${Date.now()}_${quoteData.processedImageId}.jpg`;
              
              const { data, error } = await supabase.storage
                .from(bucketName)
                .upload(fileName, imageBuffer, {
                  contentType: 'image/jpeg',
                  upsert: true
                });
              
              if (error) {
                throw new Error(`Upload failed: ${error.message}`);
              }
              
              // Get the public URL
              const { data: publicData } = supabase.storage
                .from(bucketName)
                .getPublicUrl(fileName);
              
              console.log('Successfully uploaded processed image to Supabase:', publicData.publicUrl);
              screenshotUrl = publicData.publicUrl;
            } catch (uploadError) {
              console.error('Error uploading to Supabase:', uploadError);
              // If upload fails, continue and try the fallback
            }
          } catch (fileError) {
            console.error(`Could not access processed image file: ${processedImagePath}`, fileError);
            // Fall through to next approach
          }
        } catch (fsError) {
          console.error('Error with filesystem operations:', fsError);
          // Fall through to next approach
        }
      }
      
      // If no URL from the processed image and we have a screenshot, embed it
      if (!screenshotUrl && screenshot) {
        try {
          // If client-side upload failed, add the base64 screenshot directly to the quote data
          // This avoids issues with bucket creation and permissions
          console.log('Falling back to embedding screenshot directly in quote data');
          quoteData.embeddedScreenshot = screenshot;
          
          // Indicate this approach in the logs
          screenshotUrl = 'embedded-in-json';
        } catch (screenshotError) {
          console.error('Error processing screenshot:', screenshotError);
          // Continue with the quote submission even if there's an error
        }
      }
    } else if (screenshotUrl) {
      console.log('Using provided screenshot URL:', screenshotUrl);
    }

    // Insert the quote into Supabase with screenshot URL in the screenshot_url column
    // and also in the quoteData for backward compatibility
    if (screenshotUrl) {
      quoteData.screenshot_url = screenshotUrl;
    }
    
    // Create the quote object with all necessary fields
    const quoteObject: {
      name: any;
      email: any;
      address: any;
      quote_data: any;
      user_type: any;
      screenshot_url?: string;
    } = {
      name,
      email,
      address,
      quote_data: quoteData,
      user_type: userType
    };
    
    // Add screenshot_url as a dedicated column if it exists
    if (screenshotUrl && screenshotUrl !== 'embedded-in-json') {
      quoteObject.screenshot_url = screenshotUrl;
    }
    
    // Insert the quote into Supabase
    const { data: quote, error } = await supabase
      .from('quotes')
      .insert([quoteObject])
      .select()
      .single();

    if (error) {
      console.error('Error inserting quote into Supabase:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Only attempt vendor operations if the table exists
    let vendor = null;
    try {
      // Try to check vendor table existence by running a minimal query
      let vendorsTableExists = false;
      try {
        const { data: vendorCheck, error: vendorCheckError } = await supabase
          .from('vendors')
          .select('id')
          .limit(1);
          
        // If we don't get a specific table not found error, we assume the table exists
        vendorsTableExists = !vendorCheckError || !vendorCheckError.message.includes('does not exist');
      } catch (checkError) {
        console.log('Vendors table likely does not exist:', checkError);
        vendorsTableExists = false;
      }
      
      if (vendorsTableExists) {
        // Auto-assign vendor
        const { data: vendorData, error: vendorError } = await supabase
          .from('vendors')
          .select('*')
          .eq('region', address) // or .ilike('region', `%${address}%`)
          .eq('priority_level', 1)
          .eq('active', true)
          .limit(1)
          .single();

        if (vendorError && vendorError.code !== 'PGRST116') { // PGRST116 is not found error
          console.error('Error finding vendor:', vendorError);
        } else if (vendorData) {
          vendor = vendorData;
          
          // Check if assignments table exists before inserting
          let assignmentsTableExists = false;
          try {
            const { data: assignmentsCheck, error: assignmentsCheckError } = await supabase
              .from('assignments')
              .select('id')
              .limit(1);
              
            // If we don't get a specific table not found error, we assume the table exists
            assignmentsTableExists = !assignmentsCheckError || !assignmentsCheckError.message.includes('does not exist');
          } catch (checkError) {
            console.log('Assignments table likely does not exist:', checkError);
            assignmentsTableExists = false;
          }
          
          if (assignmentsTableExists) {
            // Assign the vendor to the quote
            const { error: assignmentError } = await supabase
              .from('assignments')
              .insert([{
                quote_id: quote.id,
                vendor_id: vendor.id
              }]);

            if (assignmentError) {
              console.error('Error assigning vendor:', assignmentError);
            }
          }
        }
      } else {
        console.log('Vendors table does not exist - skipping vendor assignment');
      }
    } catch (vendorError) {
      console.error('Error in vendor lookup/assignment:', vendorError);
      // Continue without vendor assignment
    }

    // Return success response
    res.status(201).json({ 
      success: true, 
      quote,
      vendor: vendor || null,
      screenshotUrl
    });
  } catch (error) {
    console.error('Unexpected error in submit-quote:', error);
    res.status(500).json({ 
      success: false, 
      error: 'An unexpected error occurred' 
    });
  }
});

// Endpoint to register a user in Supabase when they select a payment plan
router.post('/register-user', async (req, res) => {
  try {
    const { email, role = 'free' } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    // Check if users table exists and create it if not
    try {
      // Check if the table exists first
      let usersTableExists = false;
      try {
        const { data: tableCheck, error: tableCheckError } = await supabase
          .from('users')
          .select('id')
          .limit(1);
          
        // If we don't get a specific table not found error, we assume the table exists
        usersTableExists = !tableCheckError || !tableCheckError.message.includes('does not exist');
      } catch (checkError) {
        console.log('Could not check if users table exists:', checkError);
        usersTableExists = false;
      }
      
      // If table doesn't exist, we can't create it through the API
      // Supabase requires SQL execution privileges for table creation
      if (!usersTableExists) {
        console.warn('Users table does not exist in Supabase - cannot register user');
        return res.status(500).json({ 
          success: false, 
          error: 'Users table does not exist in Supabase' 
        });
      }
    } catch (dbError) {
      console.error('Error checking users table:', dbError);
      return res.status(500).json({ 
        success: false, 
        error: 'Database error when checking users table' 
      });
    }
    
    // Check if the user already exists
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();
    
    if (findError) {
      console.error('Error checking for existing user:', findError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error checking for existing user' 
      });
    }
    
    let user;
    
    // If user exists, update their role
    if (existingUser) {
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ role })
        .eq('id', existingUser.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating user role:', updateError);
        return res.status(500).json({ 
          success: false, 
          error: 'Error updating user role' 
        });
      }
      
      user = updatedUser;
      console.log(`Updated existing user ${email} with role ${role}`);
    } 
    // Otherwise create a new user
    else {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          email,
          role,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating new user:', insertError);
        return res.status(500).json({ 
          success: false, 
          error: 'Error creating new user' 
        });
      }
      
      user = newUser;
      console.log(`Created new user ${email} with role ${role}`);
    }
    
    // Return success
    res.status(201).json({ 
      success: true, 
      user 
    });
  } catch (error) {
    console.error('Unexpected error registering user in Supabase:', error);
    res.status(500).json({ 
      success: false, 
      error: 'An unexpected error occurred' 
    });
  }
});

export default router;