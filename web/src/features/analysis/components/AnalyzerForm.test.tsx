import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useParams } from 'react-router';
import { renderRoutes } from '@/test/renderWithProviders';
import { useAnalysisStore } from '../store/analysisStore';
import { AnalyzerForm } from './AnalyzerForm';

function ResultProbe() {
  const { id = '' } = useParams();
  const result = useAnalysisStore((s) => s.results[id]);
  return <p>Result level: {result?.result.level}</p>;
}

function setup() {
  return renderRoutes([
    { path: '/', element: <AnalyzerForm /> },
    { path: '/analysis/:id', element: <ResultProbe /> },
  ]);
}

describe('AnalyzerForm', () => {
  beforeEach(() => {
    useAnalysisStore.getState().resetDraft();
  });

  it('shows a validation error and focuses the field when submitting empty text', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    const field = screen.getByLabelText('Content to analyze');
    expect(screen.getByRole('alert')).toHaveTextContent('Paste the message you want to check.');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveFocus();
  });

  it('loads a sample, marks it as fictional and switches the content type', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Fake remote job offer' }));
    expect(screen.getByLabelText<HTMLTextAreaElement>('Content to analyze').value).toContain('TalentBridge');
    expect(screen.getByText('Fictional demo sample')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Job offer' })).toBeChecked();
  });

  it('removes the sample label as soon as the text is edited', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Fake bank SMS' }));
    await user.type(screen.getByLabelText('Content to analyze'), '!');
    expect(screen.queryByText('Fictional demo sample')).not.toBeInTheDocument();
  });

  it('analyzes the text and navigates to the result', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Phishing email' }));
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    expect(await screen.findByText('Result level: critical')).toBeInTheDocument();
  });

  it('rejects multi-word input for the URL content type', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('radio', { name: 'URL' }));
    await user.type(screen.getByLabelText('Content to analyze'), 'not a link at all');
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a single link without spaces');
  });
});
