const { execSync } = require('child_process');
const { writeFileSync } = require('fs');
/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  // Your code here
  app.log.info('Yay, the app was loaded!');

  app.on('push', async (context) => {
    // Update winget-pkgs-automation/README.md (currently maintained packages)
    if (
      [
        ...context.payload.head_commit.added,
        ...context.payload.head_commit.modified,
        ...context.payload.head_commit.removed,
      ].some((file) => /^winget-pkgs-automation\/packages\/.*/g.test(file))
    ) {
      app.log.info('-----------');
      app.log.info('Updating winget-pkgs-automation/README.md');
      execSync('git pull', { cwd: `${__dirname}/..` });
      writeFileSync(
        `${__dirname}/../winget-pkgs-automation/README.md`,
        `# Currently maintained packages 📦\n\n`,
      );
      execSync(
        `Get-ChildItem . -Recurse -File | Get-Content -Raw | Where-Object {
          (Test-Json -Json $_ -SchemaFile ../schema.json -ErrorAction Ignore) -eq $true
         } | ConvertFrom-Json | Where-Object {
          $_.SkipPackage -eq $false
         } | Select-Object -ExpandProperty Identifier | Sort-Object | ForEach-Object {
          "- [$_](https://github.com/vedantmgoyal2009/vedantmgoyal2009/tree/main/winget-pkgs-automation/packages/$($_.Substring(0,1).ToLower())/$($_.ToLower()).json)"
         } | Out-File -Append -Encoding UTF8 -FilePath ${__dirname}/../winget-pkgs-automation/README.md`,
        {
          shell: 'pwsh',
          cwd: `${__dirname}/../winget-pkgs-automation/packages`,
        },
      );
      try {
        execSync(`git diff -s --exit-code README.md`, {
          cwd: `${__dirname}/../winget-pkgs-automation`,
        });
      } catch (error) {
        app.log.info('README.md has changed, committing...');
        execSync(
          `git -c commit.gpgsign=false commit --author \"vedantmgoyal2009[bot] <110876359+vedantmgoyal2009[bot]@users.noreply.github.com>\" -m \"docs(wpa): update winget-pkgs-automation/README.md\" -- README.md`,
          {
            cwd: `${__dirname}/../winget-pkgs-automation`,
          },
        );
        execSync(
          `git push https://x-access-token:${
            (
              await (
                await app.auth()
              ).apps.createInstallationAccessToken({
                installation_id: context.payload.installation.id,
              })
            ).data.token
          }@github.com/vedantmgoyal2009/vedantmgoyal2009.git`,
          {
            cwd: `${__dirname}/../winget-pkgs-automation`,
          },
        );
      }
    }
  });

  app.on('issue_comment.created', async (context) => {
    // command: /approve-and-merge
    if (context.payload.comment.body.includes('/approve-and-merge')) {
      app.log.info('-----------');
      app.log.info('command: /approve-and-merge');
      app.log.info('issue/pull_request: ' + context.payload.issue.number);
      context.octokit.pulls.removeRequestedReviewers(
        context.pullRequest({ reviewers: ['vedantmgoyal2009'] }),
      );
      context.octokit.pulls.createReview(
        context.pullRequest({ event: 'APPROVE' }),
      );
      context.octokit.pulls.merge(
        context.pullRequest({ merge_method: 'squash' }),
      );
    }

    // command: /label-and-merge
    if (context.payload.comment.body.includes('/label-and-merge')) {
      app.log.info('-----------');
      app.log.info('command: /label-and-merge');
      app.log.info('issue/pull_request: ' + context.payload.issue.number);
      let labels = context.payload.comment.body
        .replace(/\/label-and-merge/g, '')
        .split(',')
        .map((label) => label.replace(/\s+|;?/g, ''));
      app.log.info('labels: ' + labels);
      if (labels.length > 0) {
        context.octokit.issues.addLabels(context.issue({ labels: labels }));
      } else {
        app.log.error(
          'Could not parse labels, skip adding labels and merging...',
        );
      }
      context.octokit.pulls.removeRequestedReviewers(
        context.pullRequest({ reviewers: ['vedantmgoyal2009'] }),
      );
      context.octokit.pulls.createReview(
        context.pullRequest({ event: 'APPROVE' }),
      );
      context.octokit.pulls.merge(
        context.pullRequest({ merge_method: 'squash' }),
      );
    }
  });
};
