const add = async function (toolbox) {
    // Learn more about toolbox: https://infinitered.github.io/gluegun/#/toolbox-api.md
    const { ignite, print, filesystem, system, patching, template, parameters, prompt } = toolbox;

    const APP_PATH = process.cwd()
    const name = 'CHANGE_THIS';

    const props = await prompt.ask([
        {
            type: 'confirm',
            name: 'confirmed',
            message: 'If you leave any of the following questions blank they will be filled in with the string "CHANGE_THIS".',
        },
        {
            type: 'input',
            name: 'workspace',
            message: 'What is the iOS .xcworkspace file name (without .xcworkspace)?',
        },
        {
            type: 'input',
            name: 'scheme',
            message: 'What is the iOS scheme name (often same as previous answer)',
        },
        {
            type: 'input',
            name: 'bundleId',
            message: 'What is the iOS bundle identifier (ex: com.osedea.appname)?',
        },
        {
            type: 'input',
            name: 'devTeamId',
            message: 'What is the iOS developer portal team ID (developer.apple.com)?',
        },
        {
            type: 'input',
            name: 'itcTeamId',
            message: 'What is the App Store Connect team ID (appstoreconnect.apple.com)?',
        },
        {
            type: 'input',
            name: 'iosFirebaseApp',
            message: 'What is the iOS Firebase App Id (console.firebase.google.com -> Settings Gear -> Project Settings -> General -> Your apps -> Select iOS App -> App ID)?',
        },
        {
            type: 'input',
            name: 'packageName',
            message: 'What is the Android package name (ex: com.osedea.appname)?',
        },
        {
            type: 'input',
            name: 'androidFirebaseApp',
            message: 'What is the Android Firebase App Id (console.firebase.google.com -> Settings Gear -> Project Settings -> General -> Your apps -> Select Android App -> App ID)?',
        },
    ]);

    Object.keys(props).forEach((key) => {
        if (!props[key]) {
            props[key] = 'CHANGE_THIS';
        }
    });

    async function spawnIt(command, options) {
        print.info(`Running ${command} from ${options.cwd}`);
        await system.spawn(command, options);
    }

    async function templateIt(templateName, target) {
        print.info(`Generating ${target} from ${templateName}`);

        let override = true;

        if (filesystem.exists(target)) {
            override = await prompt.confirm(`${target} already exists. Override?`);
        }

        if (override) {
            await template.generate({
                directory: `${ignite.ignitePluginPath()}/templates`,
                template: templateName,
                target,
                props,
            });
        } else {
            print.info(`Skipping ${target}`);
        }
    }

    async function setupFastlane(platform) {
        print.info(`Setting up Fastlane for ${platform}`);
        const PATH = `${APP_PATH}/${platform}`;

        await templateIt(`Gemfile.ejs`, `${PATH}/Gemfile`);

        await spawnIt(`bundle config set path vendor/bundle`, { cwd: PATH, stdio: 'inherit' });
        await spawnIt('bundle install', { cwd: PATH, stdio: 'inherit' });
        await spawnIt('bundle exec fastlane init', { cwd: PATH, stdio: 'inherit' });
        const pluginFilePath = `${PATH}/fastlane/Pluginfile`;
        if (!filesystem.exists(pluginFilePath) || !patching.exists(pluginFilePath, 'firebase_app_distribution')) {
            await spawnIt('bundle exec fastlane add_plugin firebase_app_distribution', { cwd: `${PATH}/fastlane`, stdio: 'inherit' });
        }

        await templateIt(`${platform}_FastFile.ejs`, `${PATH}/fastlane/FastFile`);
        await templateIt(`${platform}_AppFile.ejs`, `${PATH}/fastlane/AppFile`)

        print.info(`Go through the generated files and replace instances of CHANGE_THIS`);
    }

    if (parameters.options['ios-only']) {
        await spawnIt('sudo gem install bundler', { cwd: APP_PATH, stdio: 'inherit' });
        await setupFastlane('ios');
    } else if (parameters.options['android-only']) {
        await spawnIt('sudo gem install bundler', { cwd: APP_PATH, stdio: 'inherit' });
        await setupFastlane('android');
    } else {
        await spawnIt('sudo gem install bundler', { cwd: APP_PATH, stdio: 'inherit' });
        await setupFastlane('ios');
        await setupFastlane('android');
    }
}

const remove = async function (toolbox) {
    const { ignite, print, filesystem, system, patching, template, parameters, prompt } = toolbox;

    const APP_PATH = process.cwd()

    async function removeFiles(platform) {
        const confirmed = await prompt.confirm(`This will delete all Fastlane related files for ${platform}. Are you sure?`);

        if (confirmed) {
            print.info(`Removing files for ${platform}`);
            const PATH = `${APP_PATH}/${platform}`;

            filesystem.remove(`${PATH}/fastlane`);
            filesystem.remove(`${PATH}/vendor`);
            filesystem.remove(`${PATH}/.bundle`);
            filesystem.remove(`${PATH}/Gemfile`);
            filesystem.remove(`${PATH}/Gemfile.lock`);
        }
    }

    if (parameters.options['ios-only']) {
        await removeFiles('ios');
    } else if (parameters.options['android-only']) {
        await removeFiles('android');
    } else {
        await removeFiles('ios');
        await removeFiles('android');
    }
}

// Required in all Ignite CLI plugins
module.exports = { add, remove }
