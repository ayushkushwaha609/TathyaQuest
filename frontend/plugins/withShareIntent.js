const { withAndroidManifest } = require('@expo/config-plugins');

function withShareIntent(config) {
  return withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    const mainActivity = mainApplication.activity.find(
      (a) => a.$['android:name'] === '.MainActivity'
    );

    if (mainActivity) {
      // Set singleTask launch mode for share intent handling
      mainActivity.$['android:launchMode'] = 'singleTask';

      // Check if SEND intent filter already exists
      const hasShareFilter = mainActivity['intent-filter']?.some((f) =>
        f.action?.some((a) => a.$['android:name'] === 'android.intent.action.SEND')
      );

      if (!hasShareFilter) {
        if (!mainActivity['intent-filter']) {
          mainActivity['intent-filter'] = [];
        }
        mainActivity['intent-filter'].push({
          action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
          category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
          data: [{ $: { 'android:mimeType': 'text/plain' } }],
        });
      }
    }

    return config;
  });
}

module.exports = withShareIntent;
