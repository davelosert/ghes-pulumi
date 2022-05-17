# GHES-Pulumi

Set up a GitHub Enterprise Server Instance on [**Azure**](https://portal.azure.com/) using [**Pulumi**](pulumi.com).

## Prerequisites

You will need both, an **Azure**- and **Pulumi**-Account and be signed in to both in your terminal:

```shell
az login
pulumi login
```

## Deploy

1. Create a SSH Keypair for the GHES admin user:

    ```shell
    ssh-keygen -m PEM -t rsa -b 4096
    ```

2. Put the two configs `adminUser` and `sshPubKeyPath` into the current environment:

    ```shell
    pulumi config set adminUser 'ghes-admin'
    pulumi config set sshPubKeyPath '/ABSOLUTE/PATH/TO/.ssh/YOUR_KEY.pub'
    ```

3. Deploy the stack

    ```shell
    pulumi up
    ```

This will print the IP and DNS of the deployed instance. From there on, you can then start following on how to [configure you GitHub Enterprise Server](https://docs.github.com/en/enterprise-server@3.4/admin/configuration/configuring-your-enterprise/about-enterprise-configuration).

## Cleanup

To remove the stack, run:

```shell
pulumi destroy
```
