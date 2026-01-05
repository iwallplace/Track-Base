import { redirect } from 'next/navigation';

export default function DashboardPage() {
    // Redirect to reports page - which serves as the main Dashboard
    redirect('/dashboard/reports');
}
