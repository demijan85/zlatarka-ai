import { redirect } from 'next/navigation';

export default function ProductionHomePage() {
  redirect('/production/dashboard');
}
