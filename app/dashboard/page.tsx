import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { hasPasscode } from '@/app/actions/settings'
import { DashboardClient } from './client'
import { FakeScreen } from './fake-screen'

export default async function DashboardPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/')
  }
  
  if (session.real) {
    const initialPasscodeSet = await hasPasscode()
    return (
      <DashboardClient 
        username={session.username} 
        email={session.email}
        initialPasscodeSet={initialPasscodeSet}
      />
    )
  }
  
  // Fake session - show decoy screen
  return <FakeScreen />
}
