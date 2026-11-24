import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { analyzeContent, type AnalyzeRequest } from '../api/analysisService';
import { useAnalysisStore } from '../store/analysisStore';

export function useAnalyze() {
  const navigate = useNavigate();
  const addResult = useAnalysisStore((s) => s.addResult);

  return useMutation({
    mutationFn: (request: AnalyzeRequest) => analyzeContent(request),
    onSuccess: (result) => {
      addResult(result);
      void navigate(`/analysis/${result.id}`);
    },
  });
}
