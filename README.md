# Care Kutumba FE

Frontend plugin for [CARE](https://github.com/ohcnetwork/care_fe) that adds
Karnataka Kutumba beneficiary lookup and family-data autofill during patient
registration, plus a sync action on existing patient records.

## Documentation

Detailed docs are maintained on the internal Confluence (access required):

- [Kutumba Overview](https://openhealthcarenetwork.atlassian.net/wiki/spaces/CPLUG/pages/45318175/Kutumba+overview)
- [Care Kutumba BE — Dev Setup](https://openhealthcarenetwork.atlassian.net/wiki/spaces/CPLUG/pages/45547543/Care+Kutumba+BE+dev+setup)
- [Care Kutumba FE — Dev Setup](https://openhealthcarenetwork.atlassian.net/wiki/spaces/CPLUG/pages/45252655/Care+Kutumba+FE+dev+setup)
- [Deploying Care Kutumba](https://openhealthcarenetwork.atlassian.net/wiki/spaces/CPLUG/pages/45613077/Deploying+Care+Kutumba)
- [Flow Demo Videos](https://openhealthcarenetwork.atlassian.net/wiki/spaces/CPLUG/pages/46006377/Flow+Demo+Videos)

> These pages are internal. If you need access, please contact the maintainers.

## Related repositories

- Backend plugin: [care_kutumba](https://github.com/10bedicu/care_kutumba)
- Host app: [care_fe](https://github.com/ohcnetwork/care_fe)


## Quick start


```sh
npm install

cp .env.example .env   # fill in REACT_* vars (see FE Dev Setup)

npm run start
```
​

For full setup, environment variables, and host integration steps, see the
[Care Kutumba FE — Dev Setup](https://openhealthcarenetwork.atlassian.net/wiki/spaces/CPLUG/pages/45252655/Care+Kutumba+FE+dev+setup)
page.

## License

MIT
