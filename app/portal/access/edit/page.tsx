import InfluencerOnboardingWizard from "@/components/influencer-onboarding-wizard";
export default async function EditAccessPage({ searchParams }:{searchParams:Promise<{token?:string}>}) { const {token=""}=await searchParams; return <InfluencerOnboardingWizard editToken={token}/>; }
