const test = require('blue-tape');
const { output, sippUac } = require('./sipp')('test_sbc-outbound');
const {execSync} = require('child_process');
const pwd = process.env.TRAVIS ? '' : '-p$MYSQL_ROOT_PASSWORD';
const debug = require('debug')('jambonz:sbc-outbound');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

function connect(connectable) {
  return new Promise((resolve, reject) => {
    connectable.on('connect', () => {
      return resolve();
    });
  });
}

test('sbc-outbound tests', async(t) => {
  const {srf} = require('../app');

  try {
    await connect(srf);
  
    /* call to unregistered user */
    await sippUac('uac-pcap-device-404.xml');
    t.pass('return 404 to outbound attempt to unregistered user/device');

    /* call to PSTN with no lcr configured */
    await sippUac('uac-pcap-carrier-success.xml');
    t.pass('successfully completed outbound call to configured sip trunk');

    // re-rack test data
    execSync(`mysql -h localhost -u root ${pwd} -D jambones_test < ${__dirname}/db/jambones-sql.sql`);
    execSync(`mysql -h localhost -u root ${pwd} -D jambones_test < ${__dirname}/db/populate-test-data2.sql`);

    /* call to PSTN with lcr configured */
    await sippUac('uac-pcap-carrier-success.xml');
    t.pass('successfully completed outbound lcr carrier with crankback after failure');

    // re-rack test data
    execSync(`mysql -h localhost -u root ${pwd} -D jambones_test < ${__dirname}/db/jambones-sql.sql`);
    execSync(`mysql -h localhost -u root ${pwd} -D jambones_test < ${__dirname}/db/populate-test-data3.sql`);

    /* call to PSTN where caller hangs up during outdial */
    await sippUac('uac-cancel.xml');
    t.pass('successfully handled caller hangup during lcr outdial');

    // re-rack test data
    execSync(`mysql -h localhost -u root ${pwd} -D jambones_test < ${__dirname}/db/jambones-sql.sql`);
    execSync(`mysql -h localhost -u root ${pwd} -D jambones_test < ${__dirname}/db/populate-test-data4.sql`);

    /* reinvite after call established */
    await sippUac('uac-pcap-carrier-success-reinvite.xml');
    t.pass('successfully handled reinvite during lcr outdial');

    srf.disconnect();
  } catch (err) {
    console.error(err);
    srf.disconnect();
    t.error(err);
  }
});
