'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

type StepStatus = 'approved' | 'not_approved' | 'needs_revision' | 'in_progress';

interface Step {
  id: string;
  name: string;
  description: string;
  status: StepStatus;
  href: string;
}

const initialSteps: Step[] = [
  {
    id: 'final-review',
    name: 'Final Deliverable',
    description: 'View your final video with voice-over',
    status: 'in_progress',
    href: '/stage4/card1'
  }
];

export default function Stage4Dashboard() {
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const router = useRouter();

  const getStatusColor = (status: StepStatus) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'not_approved':
        return 'bg-red-100 text-red-800';
      case 'needs_revision':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: StepStatus) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const calculateProgress = () => {
    const approvedSteps = steps.filter(step => step.status === 'approved').length;
    return Math.round((approvedSteps / steps.length) * 100);
  };

  const handleStatusChange = (stepId: string, newStatus: StepStatus) => {
    setSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, status: newStatus } : step
      )
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stage 4: Final Selection</h1>
            <p className="mt-2 text-gray-600">Manage and track the progress of each step</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${calculateProgress()}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">{calculateProgress()}% Complete</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {steps.map((step) => (
            <div
              key={step.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{step.name}</h3>
                  <p className="mt-1 text-gray-600">{step.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  <select
                    value={step.status}
                    onChange={(e) => handleStatusChange(step.id, e.target.value as StepStatus)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${getStatusColor(step.status)}`}
                  >
                    {['approved', 'not_approved', 'needs_revision', 'in_progress'].map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status as StepStatus)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => router.push(step.href)}
                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 