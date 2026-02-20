import React, { useState, useEffect } from 'react';
import { followupAPI } from '@/api/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Clock, CheckCircle, Phone } from 'lucide-react';
import { format } from 'date-fns';

const PendingFollowups = () => {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFollowups();
  }, []);

  const fetchFollowups = async () => {
    try {
      const response = await followupAPI.getPending();
      setFollowups(response.data);
    } catch (error) {
      toast.error('Failed to fetch follow-ups');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (id) => {
    try {
      await followupAPI.updateStatus(id, 'Completed');
      toast.success('Follow-up marked as completed');
      fetchFollowups();
    } catch (error) {
      toast.error('Failed to update follow-up');
    }
  };

  return (
    <div className="space-y-6" data-testid="pending-followups-page">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Pending Follow-ups</h1>
        <p className="text-slate-600">Today's scheduled follow-ups</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-600">Loading follow-ups...</p>
        </div>
      ) : followups.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
            <p className="text-slate-600">No pending follow-ups for today</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {followups.map((followup) => (
            <Card key={followup.id} className="border-slate-200 shadow-soft hover:shadow-lifted transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Phone className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{followup.lead_name}</h3>
                        <p className="text-sm text-slate-600">{followup.lead_number}</p>
                      </div>
                    </div>
                    
                    <div className="ml-13 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Clock className="w-4 h-4" />
                        <span>
                          {format(new Date(followup.followup_date), 'PPp')}
                        </span>
                        {followup.reminder_time && (
                          <Badge variant="outline" className="ml-2">
                            {followup.reminder_time}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="bg-slate-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-slate-700 mb-1">Note:</p>
                        <p className="text-sm text-slate-600">{followup.note}</p>
                      </div>
                      
                      <p className="text-xs text-slate-500">
                        Created by {followup.created_by_name}
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => handleComplete(followup.id)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid={`complete-followup-${followup.id}`}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark Complete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PendingFollowups;
