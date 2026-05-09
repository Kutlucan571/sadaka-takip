import { createClient } from '@supabase/supabase-js'

// Bu bilgileri yukarıda bulduğun bilgilerle değiştir
const supabaseUrl = 'https://mqbtzsdizqddggljmqzl.supabase.co/rest/v1/'
const supabaseKey = 'sb_publishable_IJI3l0lWaFV2WIuFGzaiHA_6rsGwcJb'

export const supabase = createClient(supabaseUrl, supabaseKey)