import { InfoCard } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  evaluateScorecard,
  ScorecardCheck,
  ScorecardGrade,
  ScorecardResult,
} from '@internal/plugin-scorecard-common';
import { makeStyles } from '@material-ui/core/styles';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import HighlightOffIcon from '@material-ui/icons/HighlightOff';
import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';

const useStyles = makeStyles(theme => ({
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  score: {
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1,
  },
  summary: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  item: {
    display: 'grid',
    gridTemplateColumns: '24px 1fr',
    columnGap: theme.spacing(1),
    alignItems: 'start',
    padding: theme.spacing(0.75, 0),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  passed: {
    color: theme.palette.success.main,
  },
  failed: {
    color: theme.palette.error.main,
  },
  skipped: {
    color: theme.palette.text.disabled,
  },
  title: {
    fontWeight: 600,
  },
  detail: {
    color: theme.palette.text.secondary,
    fontSize: '0.85rem',
  },
}));

const GRADE_LABEL: Record<ScorecardGrade, string> = {
  A: 'A, ready',
  B: 'B, close',
  C: 'C, gaps',
  D: 'D, not ready',
  F: 'F, not ready',
};

function StatusIcon({ check }: { check: ScorecardCheck }) {
  const classes = useStyles();
  if (check.status === 'passed') {
    return (
      <CheckCircleOutlineIcon
        className={classes.passed}
        fontSize="small"
        titleAccess="Passed"
      />
    );
  }
  if (check.status === 'failed') {
    return (
      <HighlightOffIcon
        className={classes.failed}
        fontSize="small"
        titleAccess="Failed"
      />
    );
  }
  return (
    <RemoveCircleOutlineIcon
      className={classes.skipped}
      fontSize="small"
      titleAccess="Not applicable"
    />
  );
}

function statusWord(check: ScorecardCheck): string {
  if (check.status === 'passed') {
    return 'Passed';
  }
  if (check.status === 'failed') {
    return 'Failed';
  }
  return 'Not applicable';
}

/** Presentational scorecard. Exported so tests can render without an entity context. */
export function ScorecardContent({ result }: { result: ScorecardResult }) {
  const classes = useStyles();

  return (
    <InfoCard title="Production readiness">
      <div className={classes.header}>
        <div className={classes.score} data-testid="scorecard-score">
          {result.score}
        </div>
        <div data-testid="scorecard-grade">{GRADE_LABEL[result.grade]}</div>
      </div>
      <div className={classes.summary}>
        {result.passed} passed, {result.failed} failed, out of{' '}
        {result.applicable} applicable checks. Score {result.score} is grade{' '}
        {result.grade}.
      </div>
      <ul className={classes.list}>
        {result.checks.map(check => (
          <li key={check.id} className={classes.item}>
            <StatusIcon check={check} />
            <div>
              <div className={classes.title}>
                {statusWord(check)}: {check.title}
              </div>
              <div className={classes.detail}>{check.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </InfoCard>
  );
}

/** Catalog entity card backed by the shared scorecard rules. */
export function ScorecardCard() {
  const { entity } = useEntity();
  return <ScorecardContent result={evaluateScorecard(entity)} />;
}
