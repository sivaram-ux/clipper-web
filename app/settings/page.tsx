import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { hasPasscode } from '@/app/actions/settings'
import { SettingsClient } from './client'

export default async function SettingsPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/')
  }
  
  if (!session.real) {
    redirect('/')
  }
  
  const passcodeSet = await hasPasscode()
  
  return (
    <SettingsClient 
      username={session.username} 
      email={session.email}
      passcodeSet={passcodeSet}
    />
  )
}
