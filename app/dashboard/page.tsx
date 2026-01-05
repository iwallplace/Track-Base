import { redirect } from 'next/navigation';

export default function DashboardPage() {
    // Redirect to reports page - single unified dashboard
    redirect('/dashboard/reports');
}
