import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

const SystemSettingsTab = ({ 
  onResetData,
  resetLoading
}) => {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-red-600">System Settings</h2>
      
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Reset System Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 font-medium mb-2">⚠️ Danger Zone</p>
            <p className="text-red-600 text-sm mb-4">
              This action will permanently delete ALL operational data from the system including:
            </p>
            <ul className="text-red-600 text-sm list-disc list-inside space-y-1 mb-4">
              <li>All leads and follow-ups</li>
              <li>All enrollments and student records</li>
              <li>All payments and financial data</li>
              <li>All expenses and audit logs</li>
              <li>All tasks and notifications</li>
            </ul>
            <p className="text-red-700 text-sm font-medium">
              This will NOT delete: Users, Branches, Programs, Settings
            </p>
          </div>
          
          <Button 
            variant="destructive" 
            onClick={onResetData}
            disabled={resetLoading}
            className="w-full"
            data-testid="reset-data-btn"
          >
            {resetLoading ? 'Resetting...' : 'Reset All Operational Data'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemSettingsTab;
