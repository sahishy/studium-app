import { createClient } from '@supabase/supabase-js'
import { auth } from './firebase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, {
    accessToken: async () => {

        const user = auth.currentUser
        if(!user) return null

        return (await user.getIdToken()) ?? null

    }
})