import { createContext, useContext } from 'react'
export const OnboardingContext=createContext({start:async()=>{},active:null,ready:false,rewarded:[],sidebarGroup:null})
export const useOnboarding=()=>useContext(OnboardingContext)
