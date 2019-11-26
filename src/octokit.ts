import { GitHub } from '@actions/github';
import * as TaskEither from 'fp-ts/lib/TaskEither';
import * as IOEither from 'fp-ts/lib/IOEither';
import * as Either from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/pipeable';
import { ChecksCreateResponse, ChecksUpdateParamsOutputAnnotations, ChecksUpdateParams, Response } from '@octokit/rest';

type Event = {
  check_run: {
    id: number;
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
};

export const createOctokitInstance = (token: string) =>
  TaskEither.fromIOEither(IOEither.tryCatch(() => new GitHub(token), Either.toError));

export const getGithubCheck = (octokit: GitHub, event: { owner: string; repo: string; check_run_id: number }) =>
  TaskEither.tryCatch(() => octokit.checks.get(event), Either.toError);

export const getRepositoryInfoFromEvent = (eventPath: string) =>
  pipe(
    TaskEither.fromIOEither(IOEither.tryCatch<Error, Event>(() => require(eventPath), Either.toError)),
    TaskEither.map(event => {
      const { repository, check_run } = event;
      const {
        owner: { login: owner },
      } = repository;
      const { name: repo } = repository;
      return { owner, repo, check_run_id: check_run.id };
    })
  );

export const updateGithubCheck = (
  octokit: GitHub,
  actionName: string,
  check: Response<ChecksCreateResponse>,
  event: { owner: string; repo: string },
  annotations: ChecksUpdateParamsOutputAnnotations[],
  conclusion: ChecksUpdateParams['conclusion'],
  message?: string
) =>
  TaskEither.tryCatch(
    () =>
      octokit.checks.update({
        check_run_id: check.data.id,
        owner: event.owner,
        name: actionName,
        repo: event.repo,
        status: 'completed',
        conclusion,
        completed_at: new Date().toISOString(),
        output: {
          title: actionName,
          summary: message
            ? message
            : conclusion === 'success'
            ? 'Lint completed successfully'
            : 'Lint completed with some errors',
          annotations,
        },
      }),
    Either.toError
  );
