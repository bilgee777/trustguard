import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useUser } from '@/features/auth/session';
import { analyzeContent, type AnalyzeRequest } from '../api/analysisService';
import { useAnalysisStore } from '../store/analysisStore';

export function useAnalyze() {
  const navigate = useNavigate();
  const addResult = useAnalysisStore((s) => s.addResult);
  const user = useUser();
  const saveToServer = user !== null && user.settings.historyMode !== 'off';

  return useMutation({
    mutationFn: (request: AnalyzeRequest) => analyzeContent(request, { saveToServer }),
    onSuccess: (outcome) => {
      addResult(outcome);
      void navigate(`/analysis/${outcome.result.id}`);
    },
  });
}
